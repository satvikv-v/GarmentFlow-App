"""
Customers router — full CRUD.

GET    /customers           paginated list + optional search (any auth'd user)
GET    /customers/{id}      single customer (any auth'd user)
POST   /customers           create (OWNER or SALES_EXECUTIVE)
PUT    /customers/{id}      partial update (OWNER or SALES_EXECUTIVE)
DELETE /customers/{id}      hard delete (OWNER only)
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    PaginatedCustomerResponse,
)
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["customers"])

# Shorthand dependency aliases used in the route signatures below.
AnyUser = Annotated[User, Depends(get_current_user)]
OwnerOrSales = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.SALES_EXECUTIVE)),
]
OwnerOnly = Annotated[User, Depends(require_role(UserRole.OWNER))]
DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=PaginatedCustomerResponse)
def list_customers(
    _: AnyUser,
    db: DB,
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Partial match on name or company"),
) -> PaginatedCustomerResponse:
    """Paginated customer list, optionally filtered by name/company."""
    return customer_service.list_customers(
        db, page=page, page_size=page_size, search=search
    )


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    _: AnyUser,
    db: DB,
) -> CustomerOut:
    """Fetch a single customer by id.  Returns 404 if not found."""
    return customer_service.get_customer(db, customer_id)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    body: CustomerCreate,
    _: OwnerOrSales,
    db: DB,
) -> CustomerOut:
    """Create a new customer.  Restricted to OWNER and SALES_EXECUTIVE."""
    return customer_service.create_customer(db, body)


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    _: OwnerOrSales,
    db: DB,
) -> CustomerOut:
    """Partial update.  Only supplied fields are changed.  Returns 404 if not found."""
    return customer_service.update_customer(db, customer_id, body)


@router.delete("/{customer_id}", status_code=status.HTTP_200_OK)
def delete_customer(
    customer_id: int,
    _: OwnerOnly,
    db: DB,
) -> dict:
    """Hard-delete a customer.  Restricted to OWNER only.  Returns 404 if not found."""
    return customer_service.delete_customer(db, customer_id)
