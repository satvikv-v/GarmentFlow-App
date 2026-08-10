"""
Pydantic schemas for the Inventory API.

InventoryItemCreate    -- POST body
InventoryItemUpdate    -- PUT body (all optional)
InventoryItemOut       -- shape returned by CRUD endpoints
InventoryItemDetail    -- single-item detail view (includes recent transactions)
TransactionOut         -- single transaction ledger row
StockMovementCreate    -- POST body for recording a stock movement
PaginatedInventoryResponse -- paginated list wrapper
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.enums import InventoryCategory, TransactionType


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class InventoryItemCreate(BaseModel):
    name: str
    category: InventoryCategory
    unit: str
    current_stock: float = 0
    minimum_stock: float = 0
    supplier_id: Optional[int] = None
    purchase_cost: Optional[float] = None


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[InventoryCategory] = None
    unit: Optional[str] = None
    minimum_stock: Optional[float] = None
    supplier_id: Optional[int] = None
    purchase_cost: Optional[float] = None
    # NOTE: current_stock is NOT directly editable -- use a transaction instead


class StockMovementCreate(BaseModel):
    """Body for POST /inventory/items/{id}/transactions."""
    transaction_type: TransactionType
    quantity: float
    reference: Optional[str] = None
    batch_id: Optional[int] = None   # only meaningful for issue


# ---------------------------------------------------------------------------
# Response shapes
# ---------------------------------------------------------------------------

class TransactionOut(BaseModel):
    id: int
    transaction_type: TransactionType
    quantity: float
    reference: Optional[str] = None
    batch_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InventoryItemOut(BaseModel):
    id: int
    name: str
    category: InventoryCategory
    unit: str
    current_stock: float
    minimum_stock: float
    supplier_id: Optional[int] = None
    purchase_cost: Optional[float] = None
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InventoryItemDetail(InventoryItemOut):
    """GET /inventory/items/{id} -- includes the last 20 transactions."""
    recent_transactions: List[TransactionOut] = []


# ---------------------------------------------------------------------------
# Paginated list wrapper
# ---------------------------------------------------------------------------

class PaginatedInventoryResponse(BaseModel):
    items: List[InventoryItemOut]
    total: int
    page: int
    page_size: int
