"""
Inventory consumption forecasting -- heuristic engine.

APPROACH (chosen based on Step 1 data reality check)
------------------------------------------------------
The seeded InventoryTransaction table contains 107 issue transactions spanning
a single 7-hour session (all on 2026-08-08).  There is no temporal spread, so
time-series forecasting (moving average, linear trend) would be meaningless --
fitting a trend line to data with zero temporal variance produces undefined or
degenerate results.

Instead we use a consumption-rate heuristic that is honest about what the data
actually supports:

    avg_qty_per_batch = total_issued / n_issue_transactions
        (average material consumed per production batch)

    estimated_demand = avg_qty_per_batch * open_batch_count
        (expected consumption by currently open/in-progress batches)

    suggested_reorder = max(0, estimated_demand - (current_stock - minimum_stock))
        (how much to order to cover demand without going below safety stock)

This is labeled clearly as "estimated near-term demand (consumption heuristic)"
in every API response, not as a machine-learned forecast.  When we have weeks
of real transaction history with genuine temporal spread, upgrade to a rolling
average or simple regression on issue_qty vs. date.

Items with zero issue history (9 of 15 items, all non-fabric) return a
structured "insufficient data" response rather than a made-up number.

All computation is done in pure Python against the ORM -- no additional ML
dependencies needed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, List

from sqlalchemy.orm import Session

from app.models.enums import BatchStatus, TransactionType
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.production import ProductionBatch


# Batch statuses that represent active/upcoming material consumption
ACTIVE_BATCH_STATUSES = (BatchStatus.IN_PROGRESS, BatchStatus.PLANNED)


@dataclass
class ForecastResult:
    item_id: int
    item_name: str
    unit: str
    current_stock: float
    minimum_stock: float

    # Heuristic inputs
    n_issue_transactions: int
    total_issued: float
    avg_qty_per_batch: Optional[float]        # None if no history
    open_batch_count: int

    # Outputs
    estimated_demand: Optional[float]         # None if no history
    surplus_after_demand: Optional[float]     # current_stock - estimated_demand
    suggested_reorder_qty: Optional[float]    # None if no history

    # Meta
    approach: str
    caveat: str
    has_history: bool


# Explanation text surfaced in the API response
_APPROACH_HEURISTIC = (
    "Consumption-rate heuristic: average material issued per batch "
    "(from historical issue transactions) multiplied by the number of "
    "currently open/in-progress batches.  "
    "IMPORTANT: estimated_demand and suggested_reorder_qty represent "
    "full-pipeline backlog coverage -- the total quantity needed if every "
    "open batch consumes at the historical average rate.  This is NOT an "
    "immediate or weekly order quantity; batches consume material at "
    "different stages and the actual near-term draw will be a fraction of "
    "this figure.  Use it as an upper-bound planning reference, not a "
    "purchase order trigger."
)

_APPROACH_NO_HISTORY = (
    "No issue transactions found for this item in historical data.  "
    "Cannot estimate consumption rate.  Check whether this item is consumed "
    "directly via production batches or only replenished manually."
)

_CAVEAT_HEURISTIC = (
    "DATA QUALITY: All issue transactions in the dataset occurred within a "
    "single 7-hour window (no temporal spread), so time-series forecasting "
    "would be meaningless.  Per-batch average is used as the consumption proxy.  "
    "INTERPRETATION: suggested_reorder_qty is pipeline-wide backlog coverage "
    "(all open batches modeled as concurrent), not an immediate purchase amount. "
    "Actual consumption will be spread across the production timeline.  "
    "Treat HIGH suggested quantities as a stock planning horizon, not an "
    "urgent reorder signal.  Accuracy improves with real historical data "
    "spread across multiple weeks."
)

_CAVEAT_NO_HISTORY = (
    "Item has zero issue transactions in the dataset.  "
    "Reorder suggestion cannot be computed automatically -- "
    "compare current_stock against minimum_stock manually."
)


def compute_forecast(db: Session, item: InventoryItem) -> ForecastResult:
    """
    Compute the consumption forecast / reorder suggestion for one item.

    Returns a ForecastResult.  Never raises -- degraded gracefully for
    items with no history.
    """
    # All issue transactions for this item
    issues: List[InventoryTransaction] = [
        t for t in item.transactions
        if t.transaction_type == TransactionType.ISSUE
    ]

    n_issues = len(issues)
    total_issued = sum(float(t.quantity) for t in issues)
    current_stock = float(item.current_stock)
    minimum_stock = float(item.minimum_stock)

    # Count open batches (these will consume material next)
    open_batch_count: int = (
        db.query(ProductionBatch)
        .filter(ProductionBatch.status.in_(ACTIVE_BATCH_STATUSES))
        .count()
    )

    if n_issues == 0:
        return ForecastResult(
            item_id=item.id,
            item_name=item.name,
            unit=item.unit,
            current_stock=current_stock,
            minimum_stock=minimum_stock,
            n_issue_transactions=0,
            total_issued=0.0,
            avg_qty_per_batch=None,
            open_batch_count=open_batch_count,
            estimated_demand=None,
            surplus_after_demand=None,
            suggested_reorder_qty=None,
            approach=_APPROACH_NO_HISTORY,
            caveat=_CAVEAT_NO_HISTORY,
            has_history=False,
        )

    avg_qty_per_batch = total_issued / n_issues
    estimated_demand = avg_qty_per_batch * open_batch_count

    # Safety stock buffer: keep at least minimum_stock in hand after demand
    usable_stock = max(0.0, current_stock - minimum_stock)
    shortfall = estimated_demand - usable_stock
    suggested_reorder_qty = round(max(0.0, shortfall), 2)

    surplus_after_demand = round(current_stock - estimated_demand, 2)

    return ForecastResult(
        item_id=item.id,
        item_name=item.name,
        unit=item.unit,
        current_stock=current_stock,
        minimum_stock=minimum_stock,
        n_issue_transactions=n_issues,
        total_issued=round(total_issued, 2),
        avg_qty_per_batch=round(avg_qty_per_batch, 2),
        open_batch_count=open_batch_count,
        estimated_demand=round(estimated_demand, 2),
        surplus_after_demand=surplus_after_demand,
        suggested_reorder_qty=suggested_reorder_qty,
        approach=_APPROACH_HEURISTIC,
        caveat=_CAVEAT_HEURISTIC,
        has_history=True,
    )


def get_item_forecast(db: Session, item_id: int) -> Optional[ForecastResult]:
    """
    Fetch item and compute forecast.  Returns None if item not found.
    """
    item: Optional[InventoryItem] = (
        db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    )
    if item is None:
        return None
    return compute_forecast(db, item)
