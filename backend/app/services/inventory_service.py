"""
Inventory service layer -- all DB logic for inventory items and stock
movement transactions.

Key invariant: current_stock is NEVER mutated without a matching
InventoryTransaction ledger row.  Both writes happen in the same DB
transaction so they either both commit or both roll back.
"""

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.enums import InventoryCategory, TransactionType
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.production import ProductionBatch
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemDetail,
    InventoryItemOut,
    InventoryItemUpdate,
    PaginatedInventoryResponse,
    StockMovementCreate,
    TransactionOut,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_item_or_404(db: Session, item_id: int) -> InventoryItem:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item {item_id} not found.",
        )
    return item


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

def list_items(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    category: Optional[InventoryCategory] = None,
    low_stock_only: bool = False,
) -> PaginatedInventoryResponse:
    query = db.query(InventoryItem)

    if category is not None:
        query = query.filter(InventoryItem.category == category)
    if low_stock_only:
        # is_low_stock = current_stock <= minimum_stock
        query = query.filter(InventoryItem.current_stock <= InventoryItem.minimum_stock)

    total: int = query.with_entities(func.count(InventoryItem.id)).scalar()
    offset = (page - 1) * page_size
    rows = query.order_by(InventoryItem.id).offset(offset).limit(page_size).all()

    return PaginatedInventoryResponse(
        items=[InventoryItemOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_item_detail(db: Session, item_id: int) -> InventoryItemDetail:
    """Return item + last 20 transactions, most recent first."""
    item = _get_item_or_404(db, item_id)

    recent_txns = (
        db.query(InventoryTransaction)
        .filter(InventoryTransaction.inventory_item_id == item_id)
        .order_by(desc(InventoryTransaction.created_at))
        .limit(20)
        .all()
    )

    return InventoryItemDetail(
        **InventoryItemOut.model_validate(item).model_dump(),
        recent_transactions=[TransactionOut.model_validate(t) for t in recent_txns],
    )


def create_item(db: Session, body: InventoryItemCreate) -> InventoryItem:
    item = InventoryItem(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_item(db: Session, item_id: int, body: InventoryItemUpdate) -> InventoryItem:
    item = _get_item_or_404(db, item_id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item_id: int) -> dict:
    item = _get_item_or_404(db, item_id)
    try:
        db.delete(item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Inventory item {item_id} has linked transactions or purchase orders. "
                "Remove those first."
            ),
        )
    return {"message": f"Inventory item {item_id} deleted successfully."}


def record_stock_movement(
    db: Session,
    item_id: int,
    body: StockMovementCreate,
    created_by_id: int,
) -> InventoryItemDetail:
    """
    Record a stock movement (issue / receive / adjustment).

    Both the ledger row AND the current_stock update happen in the same
    DB transaction -- if either fails, both roll back.

    Validation:
    - issue: can't take current_stock below zero
    - batch_id (if provided): must reference an existing batch
    """
    item = _get_item_or_404(db, item_id)

    # Validate batch_id if provided
    if body.batch_id is not None:
        _assert_batch(db, body.batch_id)

    # Calculate new stock
    if body.transaction_type == TransactionType.ISSUE:
        new_stock = float(item.current_stock) - body.quantity
        if new_stock < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Cannot issue {body.quantity} {item.unit} -- only "
                    f"{float(item.current_stock)} {item.unit} in stock. "
                    "Stock cannot go below zero."
                ),
            )
    elif body.transaction_type == TransactionType.RECEIVE:
        new_stock = float(item.current_stock) + body.quantity
    else:  # ADJUSTMENT -- direct set to the given quantity
        new_stock = body.quantity

    # Atomic: ledger row + stock update in the same transaction
    txn = InventoryTransaction(
        inventory_item_id=item_id,
        transaction_type=body.transaction_type,
        quantity=body.quantity,
        reference=body.reference,
        batch_id=body.batch_id,
        created_by_id=created_by_id,
    )
    db.add(txn)
    item.current_stock = new_stock
    db.commit()
    db.refresh(item)

    # Return full detail (item + recent transactions)
    return get_item_detail(db, item_id)
