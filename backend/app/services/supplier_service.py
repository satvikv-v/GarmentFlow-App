"""
Supplier service layer -- CRUD + computed delivery performance stats.

The key value-add over raw CRUD is the delivery performance calculation
on GET /suppliers/{id}:  on_time_delivery_rate and average_actual_delay_days
are computed from real PurchaseOrder rows, not just the static seeded
average_delivery_days field.
"""

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.enums import PurchaseOrderStatus
from app.models.inventory import PurchaseOrder
from app.models.supplier import Supplier
from app.schemas.supplier import (
    PaginatedPurchaseOrderResponse,
    PaginatedSupplierResponse,
    PurchaseOrderOut,
    SupplierCreate,
    SupplierDetail,
    SupplierOut,
    SupplierUpdate,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_or_404(db: Session, supplier_id: int) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier {supplier_id} not found.",
        )
    return supplier


def _compute_delivery_stats(db: Session, supplier_id: int) -> dict:
    """
    Compute delivery performance from real PurchaseOrder rows.

    Only POs with status=delivered AND both expected_delivery_date and
    actual_delivery_date populated are considered -- others don't have
    enough data to measure.
    """
    delivered_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.supplier_id == supplier_id,
            PurchaseOrder.status == PurchaseOrderStatus.DELIVERED,
            PurchaseOrder.expected_delivery_date.isnot(None),
            PurchaseOrder.actual_delivery_date.isnot(None),
        )
        .all()
    )

    total_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.supplier_id == supplier_id)
        .scalar()
    )

    if not delivered_pos:
        return {
            "total_purchase_orders": total_pos,
            "on_time_delivery_rate": None,
            "average_actual_delay_days": None,
        }

    on_time = sum(
        1 for po in delivered_pos
        if po.actual_delivery_date <= po.expected_delivery_date
    )
    delays = [
        (po.actual_delivery_date - po.expected_delivery_date).days
        for po in delivered_pos
    ]

    return {
        "total_purchase_orders": total_pos,
        "on_time_delivery_rate": round(on_time / len(delivered_pos) * 100, 1),
        "average_actual_delay_days": round(sum(delays) / len(delays), 1),
    }


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def list_suppliers(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
) -> PaginatedSupplierResponse:
    query = db.query(Supplier)
    if search:
        query = query.filter(Supplier.name.ilike(f"%{search}%"))

    total: int = query.with_entities(func.count(Supplier.id)).scalar()
    offset = (page - 1) * page_size
    rows = query.order_by(Supplier.id).offset(offset).limit(page_size).all()

    return PaginatedSupplierResponse(
        items=[SupplierOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_supplier_detail(db: Session, supplier_id: int) -> SupplierDetail:
    supplier = _get_or_404(db, supplier_id)
    stats = _compute_delivery_stats(db, supplier_id)
    return SupplierDetail(
        **SupplierOut.model_validate(supplier).model_dump(),
        **stats,
    )


def list_purchase_orders(
    db: Session,
    supplier_id: int,
    *,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedPurchaseOrderResponse:
    """Return only this supplier's POs, not all POs in the system."""
    _get_or_404(db, supplier_id)  # 404 if supplier doesn't exist

    query = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == supplier_id)
    total: int = query.with_entities(func.count(PurchaseOrder.id)).scalar()
    offset = (page - 1) * page_size
    rows = query.order_by(PurchaseOrder.id).offset(offset).limit(page_size).all()

    return PaginatedPurchaseOrderResponse(
        items=[PurchaseOrderOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def create_supplier(db: Session, body: SupplierCreate) -> Supplier:
    supplier = Supplier(**body.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


def update_supplier(db: Session, supplier_id: int, body: SupplierUpdate) -> Supplier:
    supplier = _get_or_404(db, supplier_id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier


def delete_supplier(db: Session, supplier_id: int) -> dict:
    supplier = _get_or_404(db, supplier_id)
    try:
        db.delete(supplier)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Supplier {supplier_id} still has linked inventory items or "
                "purchase orders. Remove those first."
            ),
        )
    return {"message": f"Supplier {supplier_id} deleted successfully."}
