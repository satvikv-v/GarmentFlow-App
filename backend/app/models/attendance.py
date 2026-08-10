from datetime import date as date_type
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import AttendanceStatus, pg_enum


class Attendance(Base, TimestampMixin):
    __tablename__ = "attendance"
    __table_args__ = (
        # A worker can only have one attendance record per day.
        UniqueConstraint("worker_id", "date", name="uq_attendance_worker_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("workers.id"))
    worker: Mapped["Worker"] = relationship(back_populates="attendance_records")

    date: Mapped[date_type] = mapped_column(Date)
    status: Mapped[AttendanceStatus] = mapped_column(
        pg_enum(AttendanceStatus, "attendance_status")
    )
    overtime_hours: Mapped[float] = mapped_column(Numeric(4, 2), default=0)
    output_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<Attendance {self.worker_id} {self.date} {self.status}>"
