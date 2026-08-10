from datetime import date as date_type
from typing import Optional

from sqlalchemy import String, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import DeliveryStatus, pg_enum


class Dispatch(Base, TimestampMixin):
    __tablename__ = "dispatch"

    id: Mapped[int] = mapped_column(primary_key=True)

    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    order: Mapped["Order"] = relationship(back_populates="dispatches")

    # Nullable because an order can, in principle, be dispatched across
    # multiple batches; usually 1:1 with the batch that produced the goods.
    batch_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("production_batches.id"), nullable=True
    )
    batch: Mapped[Optional["ProductionBatch"]] = relationship(back_populates="dispatch")

    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    courier: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    dispatch_date: Mapped[date_type] = mapped_column(Date)
    tracking_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        pg_enum(DeliveryStatus, "delivery_status"), default=DeliveryStatus.PENDING
    )

    def __repr__(self) -> str:
        return f"<Dispatch {self.invoice_number} ({self.delivery_status})>"
