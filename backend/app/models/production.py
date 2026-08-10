from datetime import date as date_type, datetime
from typing import List, Optional

from sqlalchemy import (
    String,
    Integer,
    Date,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import BatchStatus, StageName, StageStatus, pg_enum


class ProductionBatch(Base, TimestampMixin):
    __tablename__ = "production_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)

    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    order: Mapped["Order"] = relationship(back_populates="batches")

    production_line: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    planned_quantity: Mapped[int] = mapped_column(Integer)
    expected_completion_date: Mapped[Optional[date_type]] = mapped_column(
        Date, nullable=True
    )
    status: Mapped[BatchStatus] = mapped_column(
        pg_enum(BatchStatus, "batch_status"), default=BatchStatus.PLANNED
    )

    stages: Mapped[List["ProductionStage"]] = relationship(
        back_populates="batch", order_by="ProductionStage.sequence_order"
    )
    worker_assignments: Mapped[List["BatchWorker"]] = relationship(
        back_populates="batch"
    )
    inventory_transactions: Mapped[List["InventoryTransaction"]] = relationship(
        back_populates="batch"
    )
    dispatch: Mapped[Optional["Dispatch"]] = relationship(back_populates="batch")

    @property
    def remaining_production(self) -> int:
        """Planned quantity minus whatever the furthest-along stage has completed."""
        completed = max(
            (s.quantity_completed for s in self.stages if s.quantity_completed),
            default=0,
        )
        return max(self.planned_quantity - completed, 0)

    def __repr__(self) -> str:
        return f"<ProductionBatch {self.batch_number} ({self.status})>"


class ProductionStage(Base, TimestampMixin):
    __tablename__ = "production_stages"
    __table_args__ = (
        UniqueConstraint("batch_id", "stage_name", name="uq_stage_per_batch"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("production_batches.id"))
    batch: Mapped["ProductionBatch"] = relationship(back_populates="stages")

    stage_name: Mapped[StageName] = mapped_column(pg_enum(StageName, "stage_name"))
    # Fixed position in the workflow (1 = Fabric Allocation ... 9 = Dispatch),
    # used to render the pipeline in order and to determine "next stage".
    sequence_order: Mapped[int] = mapped_column(Integer)

    status: Mapped[StageStatus] = mapped_column(
        pg_enum(StageStatus, "stage_status"), default=StageStatus.PENDING
    )
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completion_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    quantity_completed: Mapped[int] = mapped_column(Integer, default=0)
    delay_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    worker_assignments: Mapped[List["StageWorker"]] = relationship(
        back_populates="stage"
    )

    def __repr__(self) -> str:
        return f"<ProductionStage {self.stage_name} batch={self.batch_id}>"


class BatchWorker(Base):
    """Association: which workers are assigned to a production batch overall."""

    __tablename__ = "batch_workers"

    batch_id: Mapped[int] = mapped_column(
        ForeignKey("production_batches.id"), primary_key=True
    )
    worker_id: Mapped[int] = mapped_column(ForeignKey("workers.id"), primary_key=True)

    batch: Mapped["ProductionBatch"] = relationship(back_populates="worker_assignments")
    worker: Mapped["Worker"] = relationship(back_populates="batch_assignments")


class StageWorker(Base):
    """Association: which workers actually worked a specific stage (for productivity tracking)."""

    __tablename__ = "stage_workers"

    stage_id: Mapped[int] = mapped_column(
        ForeignKey("production_stages.id"), primary_key=True
    )
    worker_id: Mapped[int] = mapped_column(ForeignKey("workers.id"), primary_key=True)

    stage: Mapped["ProductionStage"] = relationship(back_populates="worker_assignments")
    worker: Mapped["Worker"] = relationship(back_populates="stage_assignments")
