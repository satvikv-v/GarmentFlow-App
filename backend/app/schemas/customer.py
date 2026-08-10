"""
Pydantic schemas for the Customers API.

CustomerCreate       — body for POST /customers
CustomerUpdate       — body for PUT /customers/{id}  (all fields optional)
CustomerOut          — shape returned by all read/write endpoints
PaginatedCustomerResponse — wrapper for the paginated list endpoint
"""

from __future__ import annotations

from datetime import datetime
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, EmailStr


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class CustomerCreate(BaseModel):
    name: str
    company: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None


class CustomerUpdate(BaseModel):
    """All fields are optional so callers can PATCH individual attributes."""
    name: Optional[str] = None
    company: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------

class CustomerOut(BaseModel):
    id: int
    name: str
    company: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Paginated list wrapper
# ---------------------------------------------------------------------------

class PaginatedCustomerResponse(BaseModel):
    items: List[CustomerOut]
    total: int
    page: int
    page_size: int
