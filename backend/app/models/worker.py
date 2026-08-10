from typing import List, Optional

from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin


class Worker(Base, TimestampMixin):
    __tablename__ = "workers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(50))  # e.g. Cutting, Stitching
    skill: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    attendance_records: Mapped[List["Attendance"]] = relationship(
        back_populates="worker"
    )
    batch_assignments: Mapped[List["BatchWorker"]] = relationship(
        back_populates="worker"
    )
    stage_assignments: Mapped[List["StageWorker"]] = relationship(
        back_populates="worker"
    )

    def __repr__(self) -> str:
        return f"<Worker {self.name} ({self.department})>"
