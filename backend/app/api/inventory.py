"""
Inventory router -- item CRUD + stock movement transactions.

GET    /inventory/items                       paginated list (any auth'd user)
GET    /inventory/items/{id}                  detail with last 20 transactions
POST   /inventory/items                       create item (OWNER, INVENTORY_MANAGER)
PUT    /inventory/items/{id}                  update item (OWNER, INVENTORY_MANAGER)
POST   /inventory/items/{id}/transactions     record stock movement (OWNER, INVENTORY_MANAGER)
DELETE /inventory/items/{id}                  hard delete (OWNER only)
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.enums import InventoryCategory, UserRole
from app.models.user import User
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemDetail,
    InventoryItemOut,
    InventoryItemUpdate,
    PaginatedInventoryResponse,
    StockMovementCreate,
)
from app.schemas.ml import InventoryForecastResponse
from app.services import inventory_service
from app.ml import inventory_forecast

router = APIRouter(prefix="/inventory", tags=["inventory"])

# Dependency aliases
AnyUser = Annotated[User, Depends(get_current_user)]
OwnerOrInventory = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.INVENTORY_MANAGER)),
]
OwnerOnly = Annotated[User, Depends(require_role(UserRole.OWNER))]
DB = Annotated[Session, Depends(get_db)]


@router.get("/items", response_model=PaginatedInventoryResponse)
def list_items(
    _: AnyUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[InventoryCategory] = Query(None),
    low_stock_only: bool = Query(False, description="Only return items where current_stock <= minimum_stock"),
) -> PaginatedInventoryResponse:
    """Paginated inventory list with optional category and low-stock filters."""
    return inventory_service.list_items(
        db, page=page, page_size=page_size,
        category=category, low_stock_only=low_stock_only,
    )


@router.get("/items/{item_id}", response_model=InventoryItemDetail)
def get_item(
    item_id: int,
    _: AnyUser,
    db: DB,
) -> InventoryItemDetail:
    """Item detail with last 20 transactions, most recent first."""
    return inventory_service.get_item_detail(db, item_id)


@router.post("/items", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    body: InventoryItemCreate,
    _: OwnerOrInventory,
    db: DB,
) -> InventoryItemOut:
    """Create an inventory item.  OWNER or INVENTORY_MANAGER only."""
    return inventory_service.create_item(db, body)


@router.put("/items/{item_id}", response_model=InventoryItemOut)
def update_item(
    item_id: int,
    body: InventoryItemUpdate,
    _: OwnerOrInventory,
    db: DB,
) -> InventoryItemOut:
    """Update item metadata (not stock -- use a transaction for that)."""
    return inventory_service.update_item(db, item_id, body)


@router.post(
    "/items/{item_id}/transactions",
    response_model=InventoryItemDetail,
    status_code=status.HTTP_201_CREATED,
)
def record_transaction(
    item_id: int,
    body: StockMovementCreate,
    current_user: OwnerOrInventory,
    db: DB,
) -> InventoryItemDetail:
    """
    Record a stock movement (issue / receive / adjustment).

    Rules:
    - issue cannot take stock below zero (422)
    - batch_id must reference an existing batch (404)
    - ledger row + stock update are atomic
    """
    return inventory_service.record_stock_movement(
        db, item_id, body, created_by_id=current_user.id,
    )


@router.get("/items/{item_id}/forecast", response_model=InventoryForecastResponse)
def get_item_forecast(
    item_id: int,
    _: AnyUser,
    db: DB,
) -> InventoryForecastResponse:
    """
    Estimate near-term material consumption and suggest a reorder quantity.

    Approach: consumption-rate heuristic (honest about data limitations).

    The seeded InventoryTransaction table has 107 issue transactions all
    occurring within a single 7-hour window -- no temporal spread exists,
    so time-series forecasting would be meaningless.  Instead:

        avg_qty_per_batch = total_issued / n_issue_transactions
        estimated_demand  = avg_qty_per_batch x open_batch_count
        suggested_reorder = max(0, demand - usable_stock)

    Items with no issue history return null demand/reorder fields with a
    clear explanation rather than a fabricated number.

    Errors
    ------
    401  -- not authenticated
    404  -- item not found
    """
    from fastapi import HTTPException
    result = inventory_forecast.get_item_forecast(db, item_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Inventory item {item_id} not found.",
        )
    return InventoryForecastResponse(
        item_id=result.item_id,
        item_name=result.item_name,
        unit=result.unit,
        current_stock=result.current_stock,
        minimum_stock=result.minimum_stock,
        n_issue_transactions=result.n_issue_transactions,
        total_issued=result.total_issued,
        avg_qty_per_batch=result.avg_qty_per_batch,
        open_batch_count=result.open_batch_count,
        estimated_demand=result.estimated_demand,
        surplus_after_demand=result.surplus_after_demand,
        suggested_reorder_qty=result.suggested_reorder_qty,
        has_history=result.has_history,
        approach=result.approach,
        caveat=result.caveat,
    )


@router.delete("/items/{item_id}", status_code=status.HTTP_200_OK)
def delete_item(
    item_id: int,
    _: OwnerOnly,
    db: DB,
) -> dict:
    """Hard-delete an inventory item.  OWNER only."""
    return inventory_service.delete_item(db, item_id)
