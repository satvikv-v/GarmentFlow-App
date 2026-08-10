from datetime import date
from typing import List, Optional

from sqlalchemy import String, Integer, Date, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import OrderPriority, OrderType, OrderStatus, pg_enum


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)

    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    customer: Mapped["Customer"] = relationship(back_populates="orders")

    product: Mapped[str] = mapped_column(String(150))
    color: Mapped[str] = mapped_column(String(50))
    fabric: Mapped[str] = mapped_column(String(100))

    # e.g. {"S": 50, "M": 120, "L": 90, "XL": 40} — keeps size breakdown
    # flexible without needing a separate table for every possible size label.
    size_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    quantity: Mapped[int] = mapped_column(Integer)

    delivery_deadline: Mapped[date] = mapped_column(Date)
    priority: Mapped[OrderPriority] = mapped_column(
        pg_enum(OrderPriority, "order_priority"), default=OrderPriority.MEDIUM
    )
    order_type: Mapped[OrderType] = mapped_column(
        pg_enum(OrderType, "order_type"), default=OrderType.SMALL
    )
    status: Mapped[OrderStatus] = mapped_column(
        pg_enum(OrderStatus, "order_status"), default=OrderStatus.PENDING
    )

    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[Optional["User"]] = relationship()

    batches: Mapped[List["ProductionBatch"]] = relationship(back_populates="order")
    dispatches: Mapped[List["Dispatch"]] = relationship(back_populates="order")

    def __repr__(self) -> str:
        return f"<Order {self.order_number} ({self.status})>"
