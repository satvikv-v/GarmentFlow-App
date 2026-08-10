"""
Pydantic schemas for the Orders API.

OrderCreate    — POST body (status is server-side; client cannot set it)
OrderUpdate    — PUT body (all optional; customer_id excluded — immutable)
OrderOut       — shape returned by all endpoints
PaginatedOrderResponse — paginated list wrapper
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, field_validator, model_validator

from app.models.enums import OrderPriority, OrderStatus, OrderType


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class OrderCreate(BaseModel):
    customer_id: int
    product: str
    color: str
    fabric: str
    size_breakdown: Dict[str, int]
    quantity: int
    delivery_deadline: date
    priority: OrderPriority = OrderPriority.MEDIUM
    order_type: OrderType = OrderType.SMALL

    @model_validator(mode="after")
    def breakdown_must_sum_to_quantity(self) -> "OrderCreate":
        total = sum(self.size_breakdown.values())
        if total != self.quantity:
            raise ValueError(
                f"size_breakdown values sum to {total} but quantity is "
                f"{self.quantity} — they must match exactly."
            )
        return self

    @field_validator("delivery_deadline")
    @classmethod
    def deadline_not_in_past(cls, v: date) -> date:
        if v < date.today():
            raise ValueError(
                f"delivery_deadline {v} is in the past — "
                "please provide a current or future date."
            )
        return v


class OrderUpdate(BaseModel):
    """
    All fields optional for partial updates.
    customer_id is deliberately excluded — reassigning an order to a different
    customer after creation creates audit / traceability problems.
    """
    product: Optional[str] = None
    color: Optional[str] = None
    fabric: Optional[str] = None
    size_breakdown: Optional[Dict[str, int]] = None
    quantity: Optional[int] = None
    delivery_deadline: Optional[date] = None
    priority: Optional[OrderPriority] = None
    order_type: Optional[OrderType] = None
    status: Optional[OrderStatus] = None

    @model_validator(mode="after")
    def breakdown_consistent_with_quantity(self) -> "OrderUpdate":
        """
        If both size_breakdown AND quantity are supplied, they must still agree.
        If only one is supplied the service layer uses the DB value for the
        other — we can't fully validate that here, so we only check when both
        are present.
        """
        if self.size_breakdown is not None and self.quantity is not None:
            total = sum(self.size_breakdown.values())
            if total != self.quantity:
                raise ValueError(
                    f"size_breakdown values sum to {total} but quantity is "
                    f"{self.quantity} — they must match exactly."
                )
        return self


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------

class OrderOut(BaseModel):
    id: int
    order_number: str
    customer_id: int
    product: str
    color: str
    fabric: str
    size_breakdown: Dict[str, int]
    quantity: int
    delivery_deadline: date
    priority: OrderPriority
    order_type: OrderType
    status: OrderStatus
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Paginated list wrapper
# ---------------------------------------------------------------------------

class PaginatedOrderResponse(BaseModel):
    items: List[OrderOut]
    total: int
    page: int
    page_size: int
