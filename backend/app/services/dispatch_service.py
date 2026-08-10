"""
Dispatch service layer.

Key invariants:
- order_id must exist (404)
- Only orders in ready_for_dispatch, dispatched, or delivered status may
  receive a dispatch record; anything earlier is 422
- invoice_number must be unique; checked in service to return 409 not 500
- On create: auto-set parent Order.status = dispatched
- On PATCH to delivered: auto-set parent Order.status = delivered
"""

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.dispatch import Dispatch
from app.models.enums import DeliveryStatus, OrderStatus
from app.models.order import Order
from app.models.production import ProductionBatch
from app.schemas.dispatch import (
    DispatchCreate,
    DispatchOut,
    DispatchUpdate,
    PaginatedDispatchResponse,
)

# Orders must be in one of these statuses to be dispatchable
DISPATCHABLE_STATUSES = {
    OrderStatus.READY_FOR_DISPATCH,
    OrderStatus.DISPATCHED,
    OrderStatus.DELIVERED,
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_or_404(db: Session, dispatch_id: int) -> Dispatch:
    d = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if d is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dispatch record {dispatch_id} not found.",
        )
    return d


def _assert_order(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found.",
        )
    return order


def _assert_dispatchable(order: Order) -> None:
    if order.status not in DISPATCHABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Order {order.id} has status '{order.status.value}' and cannot be "
                "dispatched yet. Only orders with status ready_for_dispatch, "
                "dispatched, or delivered may have dispatch records attached."
            ),
        )


def _assert_unique_invoice(db: Session, invoice_number: str, exclude_id: Optional[int] = None) -> None:
    query = db.query(Dispatch).filter(Dispatch.invoice_number == invoice_number)
    if exclude_id is not None:
        query = query.filter(Dispatch.id != exclude_id)
    existing = query.first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invoice number '{invoice_number}' already exists on dispatch {existing.id}.",
        )


def _assert_batch(db: Session, batch_id: int) -> None:
    exists = db.query(ProductionBatch.id).filter(ProductionBatch.id == batch_id).first()
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production batch {batch_id} not found.",
        )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def list_dispatches(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    delivery_status: Optional[DeliveryStatus] = None,
    courier: Optional[str] = None,
) -> PaginatedDispatchResponse:
    query = db.query(Dispatch)
    if delivery_status is not None:
        query = query.filter(Dispatch.delivery_status == delivery_status)
    if courier is not None:
        query = query.filter(Dispatch.courier.ilike(f"%{courier}%"))

    total: int = query.with_entities(func.count(Dispatch.id)).scalar()
    offset = (page - 1) * page_size
    rows = query.order_by(Dispatch.id).offset(offset).limit(page_size).all()

    return PaginatedDispatchResponse(
        items=[DispatchOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_dispatch(db: Session, dispatch_id: int) -> DispatchOut:
    return DispatchOut.model_validate(_get_or_404(db, dispatch_id))


def create_dispatch(db: Session, body: DispatchCreate) -> DispatchOut:
    # Validate order exists and is dispatchable
    order = _assert_order(db, body.order_id)
    _assert_dispatchable(order)

    # Validate invoice uniqueness in service (not relying on DB constraint alone)
    _assert_unique_invoice(db, body.invoice_number)

    # Validate batch_id if provided
    if body.batch_id is not None:
        _assert_batch(db, body.batch_id)

    dispatch = Dispatch(**body.model_dump())
    db.add(dispatch)

    # Auto-update parent order status to dispatched
    order.status = OrderStatus.DISPATCHED

    db.commit()
    db.refresh(dispatch)
    return DispatchOut.model_validate(dispatch)


def update_dispatch(db: Session, dispatch_id: int, body: DispatchUpdate) -> DispatchOut:
    dispatch = _get_or_404(db, dispatch_id)

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(dispatch, field, value)

    # Auto-update parent order to delivered when status reaches delivered
    if body.delivery_status == DeliveryStatus.DELIVERED:
        order = db.query(Order).filter(Order.id == dispatch.order_id).first()
        if order is not None:
            order.status = OrderStatus.DELIVERED

    db.commit()
    db.refresh(dispatch)
    return DispatchOut.model_validate(dispatch)


def delete_dispatch(db: Session, dispatch_id: int) -> dict:
    dispatch = _get_or_404(db, dispatch_id)
    try:
        db.delete(dispatch)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dispatch {dispatch_id} has linked records that prevent deletion.",
        )
    return {"message": f"Dispatch {dispatch_id} deleted successfully."}
