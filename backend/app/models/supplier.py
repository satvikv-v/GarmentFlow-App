from typing import List, Optional

from sqlalchemy import String, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin


class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    contact_person: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # Free-text summary of what they supply (e.g. "Cotton fabric, buttons");
    # the actual linkage for stock/forecasting purposes is via InventoryItem.supplier_id.
    materials_supplied: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    average_delivery_days: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    quality_rating: Mapped[Optional[float]] = mapped_column(
        Numeric(2, 1), nullable=True
    )  # 0.0 - 5.0

    inventory_items: Mapped[List["InventoryItem"]] = relationship(
        back_populates="supplier"
    )
    purchase_orders: Mapped[List["PurchaseOrder"]] = relationship(
        back_populates="supplier"
    )

    def __repr__(self) -> str:
        return f"<Supplier {self.name}>"
