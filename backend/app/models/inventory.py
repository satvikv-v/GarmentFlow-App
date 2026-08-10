from datetime import date as date_type
from typing import List, Optional

from sqlalchemy import String, Numeric, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import (
    InventoryCategory,
    TransactionType,
    PurchaseOrderStatus,
    pg_enum,
)


class InventoryItem(Base, TimestampMixin):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[InventoryCategory] = mapped_column(
        pg_enum(InventoryCategory, "inventory_category")
    )
    unit: Mapped[str] = mapped_column(String(20))  # meters, pieces, kg, rolls...

    current_stock: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    minimum_stock: Mapped[float] = mapped_column(Numeric(10, 2), default=0)

    supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("suppliers.id"), nullable=True
    )
    supplier: Mapped[Optional["Supplier"]] = relationship(
        back_populates="inventory_items"
    )

    purchase_cost: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    last_purchase_date: Mapped[Optional[date_type]] = mapped_column(
        Date, nullable=True
    )

    transactions: Mapped[List["InventoryTransaction"]] = relationship(
        back_populates="inventory_item"
    )
    purchase_orders: Mapped[List["PurchaseOrder"]] = relationship(
        back_populates="inventory_item"
    )

    @property
    def is_low_stock(self) -> bool:
        return self.current_stock <= self.minimum_stock

    def __repr__(self) -> str:
        return f"<InventoryItem {self.name} stock={self.current_stock}{self.unit}>"


class InventoryTransaction(Base, TimestampMixin):
    """Every stock movement — issue, receive, or manual adjustment — recorded as an
    immutable ledger entry so stock history and consumption forecasting have a
    real audit trail instead of just the current snapshot."""

    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)

    inventory_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"))
    inventory_item: Mapped["InventoryItem"] = relationship(
        back_populates="transactions"
    )

    transaction_type: Mapped[TransactionType] = mapped_column(
        pg_enum(TransactionType, "transaction_type")
    )
    quantity: Mapped[float] = mapped_column(Numeric(10, 2))

    # If this was material issued to production, link the batch it went to.
    batch_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("production_batches.id"), nullable=True
    )
    batch: Mapped[Optional["ProductionBatch"]] = relationship(
        back_populates="inventory_transactions"
    )

    reference: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )  # e.g. PO number
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[Optional["User"]] = relationship()

    def __repr__(self) -> str:
        return f"<InventoryTransaction {self.transaction_type} {self.quantity}>"


class PurchaseOrder(Base, TimestampMixin):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True)

    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    supplier: Mapped["Supplier"] = relationship(back_populates="purchase_orders")

    inventory_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"))
    inventory_item: Mapped["InventoryItem"] = relationship(
        back_populates="purchase_orders"
    )

    quantity: Mapped[float] = mapped_column(Numeric(10, 2))
    unit_cost: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)

    order_date: Mapped[date_type] = mapped_column(Date)
    expected_delivery_date: Mapped[Optional[date_type]] = mapped_column(
        Date, nullable=True
    )
    actual_delivery_date: Mapped[Optional[date_type]] = mapped_column(
        Date, nullable=True
    )
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        pg_enum(PurchaseOrderStatus, "purchase_order_status"),
        default=PurchaseOrderStatus.ORDERED,
    )

    def __repr__(self) -> str:
        return f"<PurchaseOrder {self.id} {self.status}>"
