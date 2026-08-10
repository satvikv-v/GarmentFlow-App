"""
Pydantic schemas for the Suppliers API.

SupplierCreate         -- POST body
SupplierUpdate         -- PUT body (all optional)
SupplierOut            -- base response shape
SupplierDetail         -- extends SupplierOut with computed delivery performance
PurchaseOrderOut       -- PO row shape
PaginatedSupplierResponse   -- paginated list wrapper
PaginatedPurchaseOrderResponse -- paginated PO list wrapper
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.enums import PurchaseOrderStatus


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    materials_supplied: Optional[str] = None
    average_delivery_days: Optional[float] = None
    quality_rating: Optional[float] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    materials_supplied: Optional[str] = None
    average_delivery_days: Optional[float] = None
    quality_rating: Optional[float] = None


# ---------------------------------------------------------------------------
# Response shapes
# ---------------------------------------------------------------------------

class SupplierOut(BaseModel):
    id: int
    name: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    materials_supplied: Optional[str] = None
    average_delivery_days: Optional[float] = None
    quality_rating: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupplierDetail(SupplierOut):
    """GET /suppliers/{id} -- includes computed delivery performance stats."""
    total_purchase_orders: int = 0
    on_time_delivery_rate: Optional[float] = None   # percentage 0-100
    average_actual_delay_days: Optional[float] = None  # can be negative (early)


class PurchaseOrderOut(BaseModel):
    id: int
    supplier_id: int
    inventory_item_id: int
    quantity: float
    unit_cost: Optional[float] = None
    order_date: date
    expected_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    status: PurchaseOrderStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Paginated wrappers
# ---------------------------------------------------------------------------

class PaginatedSupplierResponse(BaseModel):
    items: List[SupplierOut]
    total: int
    page: int
    page_size: int


class PaginatedPurchaseOrderResponse(BaseModel):
    items: List[PurchaseOrderOut]
    total: int
    page: int
    page_size: int
