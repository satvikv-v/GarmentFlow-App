"""
Production recommendation engine -- scored heuristic.

STEP 1 DECISION: HEURISTIC, NOT ML
------------------------------------
This is a ranking/scoring problem.  There is no ground-truth label for "the
correct priority order" or "the correct worker allocation" in the data -- no
historical record of which ordering decisions turned out better than others.
Without a labelled training set, a trained ML model would be fabricating
structure.  A transparent weighted-score heuristic is the honest choice.

This is documented plainly in every API response, not dressed up as ML.

SCORING (0-100)
----------------
Points are awarded on four axes, then summed:

  deadline_score  (0-40)
    Days until delivery_deadline:
      overdue       40  (deadline already passed -- maximum urgency)
      <= 3 days     35
      <= 7 days     28
      <= 14 days    20
      <= 30 days    12
      > 30 days      4

  priority_score  (0-30)
    Order.priority enum:
      urgent        30
      high          20
      medium        10
      low            4

  size_score  (0-20)
    Large orders take longer and risk slipping if started late.
      quantity >= 600  20
      quantity >= 300  14
      quantity >= 100   8
      < 100             3

  fabric_risk_score  (0-10)
    Best-effort fuzzy match of order.fabric text against inventory items.
    If a matching fabric item is found:
      item.current_stock < item.minimum_stock  ->  10 (shortage risk)
      else                                     ->   0
    If no match found:                         ->   5 (unknown risk)

Total score is capped at 100.

WORKER SUGGESTION
-----------------
Rule-of-thumb: 1 worker per 50 units, minimum 3, maximum 10.
Clamped to total active worker count so the suggestion is never impossible.
Expressed as "suggested" not "allocated" -- no actual assignment is made.

EXPECTED COMPLETION ESTIMATE
-----------------------------
Production rate: 50 units / worker / day (factory default heuristic).
  days_needed = ceil(quantity / (suggested_workers * 50))
  estimated_completion = today + days_needed
Shown alongside delivery_deadline for comparison.

CAVEAT
------
Every response includes an explicit caveat stating:
- This is a heuristic score, not a trained model
- Worker suggestion is a rough guideline only
- Fabric shortage check uses fuzzy text matching; may miss items
- Completion estimate assumes constant output rate

LIMITATIONS ACKNOWLEDGED
-------------------------
1. order.fabric is free text -- no FK to inventory.  Fuzzy match will miss
   unusual spellings or fabric names not present in inventory item names.
2. Worker "capacity" is total active count by department.  The schema allows
   multi-assignment, so individual availability is not trackable.
3. Confirmed orders (status=confirmed) are included alongside pending orders
   as both represent work that needs scheduling.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.enums import BatchStatus, OrderPriority, OrderStatus
from app.models.inventory import InventoryItem
from app.models.order import Order
from app.models.production import ProductionBatch
from app.models.worker import Worker


# Production statuses that indicate an order still needs scheduling
SCHEDULABLE_STATUSES = (OrderStatus.PENDING, OrderStatus.CONFIRMED)

# Daily output per worker (units/worker/day) -- factory heuristic
UNITS_PER_WORKER_PER_DAY = 50

# Scoring weights
_PRIORITY_SCORES = {
    OrderPriority.URGENT: 30,
    OrderPriority.HIGH:   20,
    OrderPriority.MEDIUM: 10,
    OrderPriority.LOW:     4,
}


@dataclass
class OrderRecommendation:
    order_id: int
    order_number: str
    product: str
    fabric: str
    quantity: int
    priority: str
    delivery_deadline: date
    days_to_deadline: int
    current_status: str

    # Scoring breakdown
    score: int
    deadline_score: int
    priority_score: int
    size_score: int
    fabric_risk_score: int

    # Suggestions
    suggested_worker_count: int
    estimated_completion_date: date
    days_to_complete: int
    buffer_days: int       # delivery_deadline - estimated_completion_date

    # Existing batch info
    existing_batch_id: Optional[int]
    existing_batch_status: Optional[str]

    # Fabric inventory check
    fabric_item_matched: bool
    fabric_item_name: Optional[str]
    fabric_stock_sufficient: Optional[bool]  # None if no match

    # Human-readable reason
    reason: str
    caveat: str


_CAVEAT = (
    "Priority score is a weighted heuristic (deadline urgency + order priority + "
    "order size + fabric stock risk), not a trained ML model -- there is no "
    "ground-truth label for 'correct scheduling order' in this dataset.  "
    "Worker suggestion uses a rule-of-thumb (1 worker per 50 units, min 3, max 10).  "
    "Completion estimate assumes a constant rate of 50 units/worker/day.  "
    "Fabric shortage check uses fuzzy name matching and may miss items with "
    "non-standard naming.  Use as a triage tool, not a binding schedule."
)


def _deadline_score(days: int) -> int:
    if days < 0:    return 40
    if days <= 3:   return 35
    if days <= 7:   return 28
    if days <= 14:  return 20
    if days <= 30:  return 12
    return 4


def _size_score(quantity: int) -> int:
    if quantity >= 600: return 20
    if quantity >= 300: return 14
    if quantity >= 100: return 8
    return 3


def _match_fabric_item(
    fabric_text: str, inventory_items: List[InventoryItem]
) -> Optional[InventoryItem]:
    """
    Best-effort fuzzy match: find an inventory item whose name shares a
    meaningful material keyword with the order's fabric field.

    Generic words that appear across many fabric types (blend, fabric, coated,
    woven, plain, dyed, etc.) are excluded from the word-match step to avoid
    false positives like "Cotton Blend" -> "Polyester Blend Fabric".
    Only the primary material name should trigger a match.

    Returns the first match or None.
    """
    # Words that carry no discriminating signal for material identity
    STOP_WORDS = {
        "blend", "fabric", "coated", "woven", "plain", "dyed", "knit",
        "thread", "yarn", "cloth", "material", "textile", "stretch",
        "heavy", "light", "medium", "premium", "standard",
    }

    fabric_lower = fabric_text.lower()

    for item in inventory_items:
        item_lower = item.name.lower()

        # Pass 1: exact substring (e.g. "Denim" in "Denim Fabric")
        if fabric_lower in item_lower or item_lower in fabric_lower:
            return item

        # Pass 2: shared meaningful words only (length > 3, not a stop word)
        fabric_words = [
            w for w in fabric_lower.split()
            if len(w) > 3 and w not in STOP_WORDS
        ]
        item_words = [
            w for w in item_lower.split()
            if len(w) > 3 and w not in STOP_WORDS
        ]
        for word in fabric_words:
            if word in item_words:
                return item

    return None


def _suggest_workers(quantity: int, total_active: int) -> int:
    raw = math.ceil(quantity / 50)
    clamped = max(3, min(10, raw))
    return min(clamped, total_active) if total_active > 0 else clamped


def _build_reason(
    order: Order,
    days: int,
    fabric_matched: bool,
    fabric_name: Optional[str],
    stock_ok: Optional[bool],
    suggested_workers: int,
    buffer: int,
    existing_batch_status: Optional[str],
) -> str:
    parts = []

    # Priority + deadline
    pri = order.priority.value.capitalize()
    if days < 0:
        parts.append(f"{pri} priority: deadline OVERDUE by {abs(days)} day(s)")
    elif days <= 3:
        parts.append(f"{pri} priority: deadline in {days} day(s) -- CRITICAL")
    elif days <= 7:
        parts.append(f"{pri} priority: deadline in {days} days -- urgent")
    elif days <= 14:
        parts.append(f"{pri} priority: deadline in {days} days")
    else:
        parts.append(f"{pri} priority: deadline in {days} days")

    # Buffer or overrun
    if buffer < 0:
        parts.append(f"estimated completion {abs(buffer)} day(s) AFTER deadline")
    elif buffer == 0:
        parts.append("estimated completion exactly on deadline")
    elif buffer <= 3:
        parts.append(f"only {buffer}-day buffer to deadline")
    else:
        parts.append(f"{buffer}-day buffer after estimated completion")

    # Worker suggestion
    parts.append(f"suggest {suggested_workers} workers ({order.quantity} units at 50/worker/day)")

    # Fabric inventory
    if not fabric_matched:
        parts.append(
            f"fabric '{order.fabric}' not matched in inventory -- "
            "manual stock check required before batching"
        )
    elif stock_ok is False:
        parts.append(
            f"WARNING: {fabric_name} stock is at or below safety threshold -- "
            "reorder before starting production"
        )
    else:
        parts.append(f"fabric stock ({fabric_name}) appears sufficient")

    # Existing batch note
    if existing_batch_status:
        parts.append(f"existing batch already in status={existing_batch_status}")

    return "; ".join(parts) + "."


def compute_recommendations(db: Session) -> List[OrderRecommendation]:
    """
    Score and rank all schedulable (PENDING/CONFIRMED) orders.

    Single DB pass: load orders, workers, fabric items once.
    Delay risk model is NOT called per-order here (it requires a batch ORM
    object; PENDING orders without batches have no batch to score).
    Orders with existing batches include the batch status in the reason string.
    """
    today = date.today()

    orders: List[Order] = (
        db.query(Order)
        .filter(Order.status.in_(SCHEDULABLE_STATUSES))
        .all()
    )

    total_active_workers = (
        db.query(Worker).filter(Worker.is_active == True).count()
    )

    # Load all inventory items once for fabric matching
    fabric_items: List[InventoryItem] = db.query(InventoryItem).all()

    results: List[OrderRecommendation] = []

    for order in orders:
        days = (order.delivery_deadline - today).days

        d_score = _deadline_score(days)
        p_score = _PRIORITY_SCORES.get(order.priority, 0)
        s_score = _size_score(order.quantity)

        # Fabric risk
        matched_item = _match_fabric_item(order.fabric, fabric_items)
        if matched_item is None:
            f_score = 5  # unknown risk
            fabric_matched = False
            fabric_name = None
            stock_ok = None
        else:
            fabric_matched = True
            fabric_name = matched_item.name
            stock_ok = float(matched_item.current_stock) > float(matched_item.minimum_stock)
            f_score = 10 if not stock_ok else 0

        total_score = min(100, d_score + p_score + s_score + f_score)

        # Worker + completion
        suggested_workers = _suggest_workers(order.quantity, total_active_workers)
        days_needed = math.ceil(order.quantity / (suggested_workers * UNITS_PER_WORKER_PER_DAY))
        estimated_completion = today + timedelta(days=days_needed)
        buffer = (order.delivery_deadline - estimated_completion).days

        # Existing batch
        latest_batch = (
            max(order.batches, key=lambda b: b.id) if order.batches else None
        )
        existing_batch_id = latest_batch.id if latest_batch else None
        existing_batch_status = latest_batch.status.value if latest_batch else None

        reason = _build_reason(
            order=order,
            days=days,
            fabric_matched=fabric_matched,
            fabric_name=fabric_name,
            stock_ok=stock_ok,
            suggested_workers=suggested_workers,
            buffer=buffer,
            existing_batch_status=existing_batch_status,
        )

        results.append(OrderRecommendation(
            order_id=order.id,
            order_number=order.order_number,
            product=order.product,
            fabric=order.fabric,
            quantity=order.quantity,
            priority=order.priority.value,
            delivery_deadline=order.delivery_deadline,
            days_to_deadline=days,
            current_status=order.status.value,
            score=total_score,
            deadline_score=d_score,
            priority_score=p_score,
            size_score=s_score,
            fabric_risk_score=f_score,
            suggested_worker_count=suggested_workers,
            estimated_completion_date=estimated_completion,
            days_to_complete=days_needed,
            buffer_days=buffer,
            existing_batch_id=existing_batch_id,
            existing_batch_status=existing_batch_status,
            fabric_item_matched=fabric_matched,
            fabric_item_name=fabric_name,
            fabric_stock_sufficient=stock_ok,
            reason=reason,
            caveat=_CAVEAT,
        ))

    # Sort: primary = score descending, secondary = days_to_deadline ascending
    results.sort(key=lambda r: (-r.score, r.days_to_deadline))
    return results
