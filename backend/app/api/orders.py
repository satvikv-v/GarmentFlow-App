"""
Orders router — full CRUD.

GET    /orders             paginated list + filters (any auth'd user)
GET    /orders/{id}        single order (any auth'd user)
POST   /orders             create (OWNER or SALES_EXECUTIVE)
PUT    /orders/{id}        partial update (OWNER or SALES_EXECUTIVE)
DELETE /orders/{id}        hard delete (OWNER only)
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.enums import OrderPriority, OrderStatus, UserRole
from app.models.user import User
from app.schemas.order import (
    OrderCreate,
    OrderOut,
    OrderUpdate,
    PaginatedOrderResponse,
)
from app.schemas.ml import OrderRecommendationResponse, PaginatedRecommendationResponse
from app.services import order_service
from app.ml import production_recommender

router = APIRouter(prefix="/orders", tags=["orders"])

# Dependency aliases — keeps route signatures readable.
AnyUser = Annotated[User, Depends(get_current_user)]
OwnerOrSales = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.SALES_EXECUTIVE)),
]
OwnerOnly = Annotated[User, Depends(require_role(UserRole.OWNER))]
DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=PaginatedOrderResponse)
def list_orders(
    current_user: AnyUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[OrderStatus] = Query(None, description="Filter by order status"),
    priority: Optional[OrderPriority] = Query(None, description="Filter by priority"),
    customer_id: Optional[int] = Query(None, description="Filter by customer"),
) -> PaginatedOrderResponse:
    """Paginated order list with optional status/priority/customer_id filters."""
    return order_service.list_orders(
        db,
        page=page,
        page_size=page_size,
        status_filter=status,
        priority_filter=priority,
        customer_id=customer_id,
    )


@router.get("/recommendations", response_model=PaginatedRecommendationResponse)
def get_recommendations(
    _: AnyUser,
    db: DB,
) -> PaginatedRecommendationResponse:
    """
    Rank schedulable (PENDING/CONFIRMED) orders by suggested production priority.

    APPROACH: Weighted-score heuristic -- NOT a trained ML model.
    No ground-truth label for 'correct scheduling order' exists in this dataset.
    Score = deadline urgency (0-40) + order priority (0-30)
            + order size (0-20) + fabric stock risk (0-10).

    Each item includes:
    - score breakdown (transparent, not a black box)
    - suggested worker count (rule-of-thumb: 1 per 50 units, min 3, max 10)
    - estimated completion date (assumes 50 units/worker/day constant rate)
    - buffer_days: days between estimated completion and deadline
      (negative = estimated to finish AFTER deadline)
    - fabric_stock_sufficient: best-effort fuzzy match against inventory items
    - reason: plain-language summary of all flags
    - caveat: honest statement of heuristic limitations

    Sorted by score descending, then days_to_deadline ascending.
    Response time: single DB pass (orders + workers + inventory loaded once).

    Errors
    ------
    401  -- not authenticated
    """
    import time
    recs = production_recommender.compute_recommendations(db)
    items = [
        OrderRecommendationResponse(
            order_id=r.order_id,
            order_number=r.order_number,
            product=r.product,
            fabric=r.fabric,
            quantity=r.quantity,
            priority=r.priority,
            delivery_deadline=r.delivery_deadline.isoformat(),
            days_to_deadline=r.days_to_deadline,
            current_status=r.current_status,
            score=r.score,
            deadline_score=r.deadline_score,
            priority_score=r.priority_score,
            size_score=r.size_score,
            fabric_risk_score=r.fabric_risk_score,
            suggested_worker_count=r.suggested_worker_count,
            estimated_completion_date=r.estimated_completion_date.isoformat(),
            days_to_complete=r.days_to_complete,
            buffer_days=r.buffer_days,
            existing_batch_id=r.existing_batch_id,
            existing_batch_status=r.existing_batch_status,
            fabric_item_matched=r.fabric_item_matched,
            fabric_item_name=r.fabric_item_name,
            fabric_stock_sufficient=r.fabric_stock_sufficient,
            reason=r.reason,
            caveat=r.caveat,
        )
        for r in recs
    ]
    return PaginatedRecommendationResponse(total=len(items), items=items)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    _: AnyUser,
    db: DB,
) -> OrderOut:
    """Fetch a single order by id.  Returns 404 if not found."""
    return order_service.get_order(db, order_id)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    body: OrderCreate,
    current_user: OwnerOrSales,
    db: DB,
) -> OrderOut:
    """
    Create a new order.  Restricted to OWNER and SALES_EXECUTIVE.

    Enforced by service layer:
    - customer_id must reference an existing customer (404 not FK error)
    - size_breakdown values must sum to quantity (422 with clear message)
    - delivery_deadline must not be in the past (422 via schema validator)
    """
    return order_service.create_order(db, body, created_by_id=current_user.id)


@router.put("/{order_id}", response_model=OrderOut)
def update_order(
    order_id: int,
    body: OrderUpdate,
    _: OwnerOrSales,
    db: DB,
) -> OrderOut:
    """Partial update.  customer_id cannot be changed.  Returns 404 if missing."""
    return order_service.update_order(db, order_id, body)


@router.delete("/{order_id}", status_code=status.HTTP_200_OK)
def delete_order(
    order_id: int,
    _: OwnerOnly,
    db: DB,
) -> dict:
    """Hard-delete an order.  Restricted to OWNER only.  Returns 404 if missing."""
    return order_service.delete_order(db, order_id)
