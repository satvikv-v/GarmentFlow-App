"""
Dispatch router.

GET    /dispatch             paginated list (any auth'd user)
GET    /dispatch/{id}        single record (any auth'd user)
POST   /dispatch             create (OWNER, SALES_EXECUTIVE)
PATCH  /dispatch/{id}        update status/tracking (OWNER, SALES_EXECUTIVE)
DELETE /dispatch/{id}        hard delete (OWNER only)
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.enums import DeliveryStatus, UserRole
from app.models.user import User
from app.schemas.dispatch import (
    DispatchCreate,
    DispatchOut,
    DispatchUpdate,
    PaginatedDispatchResponse,
)
from app.services import dispatch_service

router = APIRouter(prefix="/dispatch", tags=["dispatch"])

# Dependency aliases
AnyUser = Annotated[User, Depends(get_current_user)]
OwnerOrSales = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.SALES_EXECUTIVE)),
]
OwnerOnly = Annotated[User, Depends(require_role(UserRole.OWNER))]
DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=PaginatedDispatchResponse)
def list_dispatches(
    _: AnyUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    delivery_status: Optional[DeliveryStatus] = Query(None),
    courier: Optional[str] = Query(None, description="Partial match on courier name"),
) -> PaginatedDispatchResponse:
    return dispatch_service.list_dispatches(
        db, page=page, page_size=page_size,
        delivery_status=delivery_status, courier=courier,
    )


@router.get("/{dispatch_id}", response_model=DispatchOut)
def get_dispatch(
    dispatch_id: int,
    _: AnyUser,
    db: DB,
) -> DispatchOut:
    return dispatch_service.get_dispatch(db, dispatch_id)


@router.post("", response_model=DispatchOut, status_code=status.HTTP_201_CREATED)
def create_dispatch(
    body: DispatchCreate,
    _: OwnerOrSales,
    db: DB,
) -> DispatchOut:
    """
    Create a dispatch record.  OWNER or SALES_EXECUTIVE only.

    Enforced:
    - order_id must exist (404)
    - order must be ready_for_dispatch / dispatched / delivered (422)
    - invoice_number must be unique (409)
    - parent order.status auto-set to dispatched on creation
    """
    return dispatch_service.create_dispatch(db, body)


@router.patch("/{dispatch_id}", response_model=DispatchOut)
def update_dispatch(
    dispatch_id: int,
    body: DispatchUpdate,
    _: OwnerOrSales,
    db: DB,
) -> DispatchOut:
    """
    Update delivery_status or tracking info.
    When status reaches delivered, parent order.status auto-flips to delivered.
    """
    return dispatch_service.update_dispatch(db, dispatch_id, body)


@router.delete("/{dispatch_id}", status_code=status.HTTP_200_OK)
def delete_dispatch(
    dispatch_id: int,
    _: OwnerOnly,
    db: DB,
) -> dict:
    return dispatch_service.delete_dispatch(db, dispatch_id)
