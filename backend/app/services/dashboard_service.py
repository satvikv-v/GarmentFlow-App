"""
Dashboard service layer — aggregates existing data into a single summary.

Design goals
------------
- Zero N+1 queries: every metric is a single SQL COUNT / SUM / aggregate.
- No business logic is re-invented: low_stock uses the same column comparison
  as inventory_service.list_items(low_stock_only=True), delayed counts reuse
  the BatchStatus / StageStatus enums already used everywhere else.
- The entire function runs in one DB session; no HTTP calls to other endpoints.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import case, distinct, func, Integer
from sqlalchemy.orm import Session

from app.models.enums import BatchStatus, OrderStatus, StageStatus
from app.models.inventory import InventoryItem
from app.models.order import Order
from app.models.production import ProductionBatch, ProductionStage
from app.schemas.dashboard import DashboardLowStockItem, DashboardSummary


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


# ---------------------------------------------------------------------------
# Public function
# ---------------------------------------------------------------------------

def get_summary(db: Session) -> DashboardSummary:
    """
    Return the full dashboard summary.

    Each metric is a separate, single-pass aggregate query — no ORM row
    iteration in Python, no N+1 joins.
    """
    today = _today_utc()
    deadline_cutoff = today + timedelta(days=3)  # <= this date counts as "near"
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # Statuses that mean an order is "done" (not active)
    terminal_statuses = [OrderStatus.DELIVERED, OrderStatus.CANCELLED]
    active_filter = ~Order.status.in_(terminal_statuses)

    # ---------------------------------------------------------------
    # 1. active_orders_count
    # ---------------------------------------------------------------
    active_orders_count: int = (
        db.query(func.count(Order.id))
        .filter(active_filter)
        .scalar()
        or 0
    )

    # ---------------------------------------------------------------
    # 2. orders_near_deadline
    #    delivery_deadline within the next 3 calendar days AND active
    # ---------------------------------------------------------------
    orders_near_deadline: int = (
        db.query(func.count(Order.id))
        .filter(
            active_filter,
            Order.delivery_deadline <= deadline_cutoff,
            Order.delivery_deadline >= today,
        )
        .scalar()
        or 0
    )

    # ---------------------------------------------------------------
    # 3. delayed_orders_count
    #    Orders that have a batch with status=delayed
    #    OR that have at least one stage with status=delayed.
    #    We collect distinct order_ids from both sources and count them.
    # ---------------------------------------------------------------
    delayed_via_batch = (
        db.query(ProductionBatch.order_id)
        .filter(ProductionBatch.status == BatchStatus.DELAYED)
    )
    delayed_via_stage = (
        db.query(ProductionBatch.order_id)
        .join(ProductionStage, ProductionStage.batch_id == ProductionBatch.id)
        .filter(ProductionStage.status == StageStatus.DELAYED)
    )
    all_delayed_order_ids = delayed_via_batch.union(delayed_via_stage).subquery()
    delayed_orders_count: int = (
        db.query(func.count())
        .select_from(all_delayed_order_ids)
        .scalar()
        or 0
    )

    # ---------------------------------------------------------------
    # 4. pending_dispatch_count
    # ---------------------------------------------------------------
    pending_dispatch_count: int = (
        db.query(func.count(Order.id))
        .filter(Order.status == OrderStatus.READY_FOR_DISPATCH)
        .scalar()
        or 0
    )

    # ---------------------------------------------------------------
    # 5. todays_production
    #    completion_time is stored as a naive datetime (UTC).
    #    We cast to DATE and compare to today.
    # ---------------------------------------------------------------
    todays_production: int = (
        db.query(func.coalesce(func.sum(ProductionStage.quantity_completed), 0))
        .filter(
            ProductionStage.status == StageStatus.COMPLETED,
            ProductionStage.completion_time.isnot(None),
            func.date(ProductionStage.completion_time) == today,
        )
        .scalar()
        or 0
    )

    # ---------------------------------------------------------------
    # 6. weekly_production — last 7 days
    # ---------------------------------------------------------------
    weekly_production: int = (
        db.query(func.coalesce(func.sum(ProductionStage.quantity_completed), 0))
        .filter(
            ProductionStage.status == StageStatus.COMPLETED,
            ProductionStage.completion_time.isnot(None),
            func.date(ProductionStage.completion_time) >= week_ago,
        )
        .scalar()
        or 0
    )

    # ---------------------------------------------------------------
    # 7. monthly_production — last 30 days
    # ---------------------------------------------------------------
    monthly_production: int = (
        db.query(func.coalesce(func.sum(ProductionStage.quantity_completed), 0))
        .filter(
            ProductionStage.status == StageStatus.COMPLETED,
            ProductionStage.completion_time.isnot(None),
            func.date(ProductionStage.completion_time) >= month_ago,
        )
        .scalar()
        or 0
    )

    # ---------------------------------------------------------------
    # 8. factory_efficiency
    #    % of completed stages in the last 30 days that are NOT delayed.
    #    A stage is "completed on time" if it reached status=completed
    #    and never had status=delayed recorded.
    #
    #    Practical definition (consistent with seed data):
    #      Among all stages with completion_time in the last 30 days,
    #      what fraction have status=completed (not delayed)?
    # ---------------------------------------------------------------
    recent_completed_stages_q = db.query(ProductionStage).filter(
        ProductionStage.completion_time.isnot(None),
        func.date(ProductionStage.completion_time) >= month_ago,
    )
    total_recent = recent_completed_stages_q.with_entities(
        func.count(ProductionStage.id)
    ).scalar() or 0

    on_time_recent = recent_completed_stages_q.filter(
        ProductionStage.status == StageStatus.COMPLETED,
    ).with_entities(func.count(ProductionStage.id)).scalar() or 0

    factory_efficiency: float = (
        round((on_time_recent / total_recent) * 100, 2)
        if total_recent > 0
        else 100.0
    )

    # ---------------------------------------------------------------
    # 9. inventory_health
    #    % of items where current_stock > minimum_stock
    # ---------------------------------------------------------------
    total_items: int = (
        db.query(func.count(InventoryItem.id)).scalar() or 0
    )
    healthy_items: int = (
        db.query(func.count(InventoryItem.id))
        .filter(InventoryItem.current_stock > InventoryItem.minimum_stock)
        .scalar()
        or 0
    )
    inventory_health: float = (
        round((healthy_items / total_items) * 100, 2)
        if total_items > 0
        else 100.0
    )

    # ---------------------------------------------------------------
    # 10. low_stock_materials
    #     Identical filter to inventory_service.list_items(low_stock_only=True).
    #     current_stock <= minimum_stock  (using the same column comparison).
    # ---------------------------------------------------------------
    low_stock_rows = (
        db.query(InventoryItem)
        .filter(InventoryItem.current_stock <= InventoryItem.minimum_stock)
        .order_by(InventoryItem.id)
        .all()
    )
    low_stock_materials = [
        DashboardLowStockItem(
            id=item.id,
            name=item.name,
            current_stock=float(item.current_stock),
            minimum_stock=float(item.minimum_stock),
        )
        for item in low_stock_rows
    ]

    return DashboardSummary(
        active_orders_count=active_orders_count,
        orders_near_deadline=orders_near_deadline,
        delayed_orders_count=delayed_orders_count,
        pending_dispatch_count=pending_dispatch_count,
        todays_production=int(todays_production),
        weekly_production=int(weekly_production),
        monthly_production=int(monthly_production),
        factory_efficiency=factory_efficiency,
        inventory_health=inventory_health,
        low_stock_materials=low_stock_materials,
    )
