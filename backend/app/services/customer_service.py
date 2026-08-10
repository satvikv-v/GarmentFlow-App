"""
Customer service layer — all DB query logic lives here, keeping route
handlers thin.

Functions
---------
list_customers   — paginated list with optional case-insensitive search
get_customer     — single customer by PK, raises 404 if missing
create_customer  — insert and return the new row
update_customer  — partial update (only supplied fields), raises 404
delete_customer  — hard delete, raises 404 if missing
"""

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.schemas.customer import (
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    PaginatedCustomerResponse,
)


def list_customers(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
) -> PaginatedCustomerResponse:
    """
    Return a paginated slice of customers.

    ``search`` is matched case-insensitively against name OR company using
    ILIKE (Postgres).  When omitted, all customers are returned.
    """
    query = db.query(Customer)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Customer.name.ilike(pattern),
                Customer.company.ilike(pattern),
            )
        )

    total: int = query.with_entities(func.count(Customer.id)).scalar()

    offset = (page - 1) * page_size
    rows = query.order_by(Customer.id).offset(offset).limit(page_size).all()

    return PaginatedCustomerResponse(
        items=[CustomerOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_customer(db: Session, customer_id: int) -> Customer:
    """Return a Customer row or raise HTTP 404."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found.",
        )
    return customer


def create_customer(db: Session, body: CustomerCreate) -> Customer:
    """Insert a new customer and return the persisted row."""
    customer = Customer(**body.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def update_customer(
    db: Session, customer_id: int, body: CustomerUpdate
) -> Customer:
    """
    Partial update — only fields explicitly supplied in the request body are
    written; omitted fields are left unchanged.
    """
    customer = get_customer(db, customer_id)  # raises 404 if missing

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer_id: int) -> dict:
    """Hard-delete a customer.  Raises 404 if the id doesn't exist."""
    customer = get_customer(db, customer_id)  # raises 404 if missing
    db.delete(customer)
    db.commit()
    return {"message": f"Customer {customer_id} deleted successfully."}
