"""
Order service layer — all DB query / business logic lives here.

Functions
---------
_next_order_number   — generates ORD-NNNN that doesn't collide with any existing number
_assert_customer     — raises 404 if customer_id doesn't exist
list_orders          — paginated list with status/priority/customer_id filters
get_order            — single order by PK, raises 404
create_order         — validates customer, inserts row, auto-numbers
update_order         — partial update, re-validates breakdown if needed
delete_order         — hard delete, raises 404
"""

from datetime import date
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import cast, func, Integer, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.enums import OrderPriority, OrderStatus
from app.models.order import Order
from app.schemas.order import (
    OrderCreate,
    OrderOut,
    OrderUpdate,
    PaginatedOrderResponse,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _assert_customer(db: Session, customer_id: int) -> None:
    """Raise HTTP 404 (not a raw FK error) if the customer doesn't exist."""
    exists = db.query(Customer.id).filter(Customer.id == customer_id).first()
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found.",
        )


def _next_order_number(db: Session) -> str:
    """
    Return the next unused ORD-NNNN number.

    Seed data uses ORD-2000..ORD-2119.  We find the highest numeric suffix
    across all existing orders and increment it, so there's never a collision
    regardless of how many orders have been created or deleted.
    """
    max_num = (
        db.query(
            func.max(cast(func.split_part(Order.order_number, "-", 2), Integer))
        ).scalar()
    )
    next_num = (max_num or 0) + 1
    return f"ORD-{next_num}"


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def list_orders(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[OrderStatus] = None,
    priority_filter: Optional[OrderPriority] = None,
    customer_id: Optional[int] = None,
) -> PaginatedOrderResponse:
    """Paginated order list with optional enum and FK filters."""
    query = db.query(Order)

    if status_filter is not None:
        query = query.filter(Order.status == status_filter)
    if priority_filter is not None:
        query = query.filter(Order.priority == priority_filter)
    if customer_id is not None:
        query = query.filter(Order.customer_id == customer_id)

    total: int = query.with_entities(func.count(Order.id)).scalar()
    offset = (page - 1) * page_size
    rows = query.order_by(Order.id).offset(offset).limit(page_size).all()

    return PaginatedOrderResponse(
        items=[OrderOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_order(db: Session, order_id: int) -> Order:
    """Return an Order or raise HTTP 404."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found.",
        )
    return order


def create_order(db: Session, body: OrderCreate, created_by_id: int) -> Order:
    """
    Validate customer exists (404 not FK error), generate a non-colliding
    order_number, and insert the row with status=PENDING.
    """
    _assert_customer(db, body.customer_id)

    order = Order(
        order_number=_next_order_number(db),
        customer_id=body.customer_id,
        product=body.product,
        color=body.color,
        fabric=body.fabric,
        size_breakdown=body.size_breakdown,
        quantity=body.quantity,
        delivery_deadline=body.delivery_deadline,
        priority=body.priority,
        order_type=body.order_type,
        status=OrderStatus.PENDING,
        created_by_id=created_by_id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def update_order(db: Session, order_id: int, body: OrderUpdate) -> Order:
    """
    Partial update.  If size_breakdown is updated without quantity (or vice
    versa) the service fetches the current DB value for the missing side and
    validates consistency before committing.
    """
    order = get_order(db, order_id)  # 404 if missing

    updates = body.model_dump(exclude_unset=True)

    # Cross-field consistency check when only one of the pair is supplied.
    new_breakdown = updates.get("size_breakdown", order.size_breakdown)
    new_quantity = updates.get("quantity", order.quantity)
    if new_breakdown and sum(new_breakdown.values()) != new_quantity:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"size_breakdown values sum to {sum(new_breakdown.values())} "
                f"but quantity is {new_quantity} — they must match exactly."
            ),
        )

    for field, value in updates.items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)
    return order


def delete_order(db: Session, order_id: int) -> dict:
    """
    Hard-delete an order.  Raises 404 if the id doesn't exist.
    Raises 409 if the order has linked production batches or dispatch records
    that must be removed first.
    """
    order = get_order(db, order_id)
    try:
        db.delete(order)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Order {order_id} has linked production batches or dispatch "
                "records. Remove those first, or cancel the order instead of deleting it."
            ),
        )
    return {"message": f"Order {order_id} deleted successfully."}
