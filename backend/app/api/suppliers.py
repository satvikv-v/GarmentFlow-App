"""
Suppliers router -- CRUD + purchase order listing + delivery performance.

GET    /suppliers                            paginated list (any auth'd user)
GET    /suppliers/{id}                       detail with computed delivery stats
GET    /suppliers/{id}/purchase-orders       that supplier's POs only
POST   /suppliers                            create (OWNER, INVENTORY_MANAGER)
PUT    /suppliers/{id}                       update (OWNER, INVENTORY_MANAGER)
DELETE /suppliers/{id}                       hard delete (OWNER only, 409 if FK linked)
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.supplier import (
    PaginatedPurchaseOrderResponse,
    PaginatedSupplierResponse,
    SupplierCreate,
    SupplierDetail,
    SupplierOut,
    SupplierUpdate,
)
from app.services import supplier_service

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

# Dependency aliases
AnyUser = Annotated[User, Depends(get_current_user)]
OwnerOrInventory = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.INVENTORY_MANAGER)),
]
OwnerOnly = Annotated[User, Depends(require_role(UserRole.OWNER))]
DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=PaginatedSupplierResponse)
def list_suppliers(
    _: AnyUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Partial match on supplier name"),
) -> PaginatedSupplierResponse:
    return supplier_service.list_suppliers(
        db, page=page, page_size=page_size, search=search,
    )


@router.get("/{supplier_id}", response_model=SupplierDetail)
def get_supplier(
    supplier_id: int,
    _: AnyUser,
    db: DB,
) -> SupplierDetail:
    """Detail view with computed delivery performance stats."""
    return supplier_service.get_supplier_detail(db, supplier_id)


@router.get("/{supplier_id}/purchase-orders", response_model=PaginatedPurchaseOrderResponse)
def list_purchase_orders(
    supplier_id: int,
    _: AnyUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedPurchaseOrderResponse:
    """Only this supplier's POs, not all POs in the system."""
    return supplier_service.list_purchase_orders(
        db, supplier_id, page=page, page_size=page_size,
    )


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    body: SupplierCreate,
    _: OwnerOrInventory,
    db: DB,
) -> SupplierOut:
    return supplier_service.create_supplier(db, body)


@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    body: SupplierUpdate,
    _: OwnerOrInventory,
    db: DB,
) -> SupplierOut:
    return supplier_service.update_supplier(db, supplier_id, body)


@router.delete("/{supplier_id}", status_code=status.HTTP_200_OK)
def delete_supplier(
    supplier_id: int,
    _: OwnerOnly,
    db: DB,
) -> dict:
    return supplier_service.delete_supplier(db, supplier_id)
