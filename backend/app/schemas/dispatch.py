"""
Pydantic schemas for the Dispatch API.

DispatchCreate  -- POST body
DispatchUpdate  -- PATCH body (delivery_status, tracking_number)
DispatchOut     -- full response shape
PaginatedDispatchResponse -- paginated list wrapper
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.enums import DeliveryStatus


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class DispatchCreate(BaseModel):
    order_id: int
    batch_id: Optional[int] = None
    invoice_number: str
    courier: Optional[str] = None
    dispatch_date: date
    tracking_number: Optional[str] = None
    delivery_status: DeliveryStatus = DeliveryStatus.PENDING


class DispatchUpdate(BaseModel):
    delivery_status: Optional[DeliveryStatus] = None
    tracking_number: Optional[str] = None
    courier: Optional[str] = None


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------

class DispatchOut(BaseModel):
    id: int
    order_id: int
    batch_id: Optional[int] = None
    invoice_number: str
    courier: Optional[str] = None
    dispatch_date: date
    tracking_number: Optional[str] = None
    delivery_status: DeliveryStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Paginated wrapper
# ---------------------------------------------------------------------------

class PaginatedDispatchResponse(BaseModel):
    items: List[DispatchOut]
    total: int
    page: int
    page_size: int
