"""
Worker service layer -- CRUD + computed productivity from real attendance data.

Key design decisions:
- attendance_rate = (present + half_day) / total_records over last 30 days
- average_daily_output = sum(output_quantity) / days_with_output over last 30 days
- Delete = soft-delete (is_active=False) when the worker has any historical
  records (BatchWorker, StageWorker, Attendance), preserving audit trail
"""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, desc, distinct
from sqlalchemy.orm import Session

from app.models.attendance import Attendance
from app.models.enums import AttendanceStatus
from app.models.production import BatchWorker, StageWorker
from app.models.worker import Worker
from app.schemas.worker import (
    AttendanceRecordOut,
    DepartmentProductivity,
    PaginatedAttendanceResponse,
    PaginatedWorkerResponse,
    WorkerCreate,
    WorkerDetail,
    WorkerOut,
    WorkerUpdate,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_or_404(db: Session, worker_id: int) -> Worker:
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if worker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker {worker_id} not found.",
        )
    return worker


def _compute_productivity(db: Session, worker_id: int) -> dict:
    """
    Compute attendance_rate, total_output_last_30_days, average_daily_output
    from real Attendance rows over the last 30 calendar days.
    """
    cutoff = date.today() - timedelta(days=30)

    records = (
        db.query(Attendance)
        .filter(
            Attendance.worker_id == worker_id,
            Attendance.date >= cutoff,
        )
        .all()
    )

    if not records:
        return {
            "attendance_rate": None,
            "total_output_last_30_days": None,
            "average_daily_output": None,
        }

    total_days = len(records)
    present_days = sum(
        1 for r in records
        if r.status in (AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY)
    )
    attendance_rate = round(present_days / total_days * 100, 1)

    outputs = [r.output_quantity for r in records if r.output_quantity is not None]
    total_output = sum(outputs) if outputs else 0
    avg_output = round(total_output / len(outputs), 1) if outputs else None

    return {
        "attendance_rate": attendance_rate,
        "total_output_last_30_days": total_output,
        "average_daily_output": avg_output,
    }


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def list_workers(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> PaginatedWorkerResponse:
    query = db.query(Worker)
    if department is not None:
        query = query.filter(Worker.department == department)
    if is_active is not None:
        query = query.filter(Worker.is_active == is_active)

    total: int = query.with_entities(func.count(Worker.id)).scalar()
    offset = (page - 1) * page_size
    rows = query.order_by(Worker.id).offset(offset).limit(page_size).all()

    return PaginatedWorkerResponse(
        items=[WorkerOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_worker_detail(db: Session, worker_id: int) -> WorkerDetail:
    worker = _get_or_404(db, worker_id)
    stats = _compute_productivity(db, worker_id)
    return WorkerDetail(
        **WorkerOut.model_validate(worker).model_dump(),
        **stats,
    )


def list_attendance(
    db: Session,
    worker_id: int,
    *,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedAttendanceResponse:
    _get_or_404(db, worker_id)
    query = db.query(Attendance).filter(Attendance.worker_id == worker_id)

    total: int = query.with_entities(func.count(Attendance.id)).scalar()
    offset = (page - 1) * page_size
    rows = (
        query.order_by(desc(Attendance.date))
        .offset(offset).limit(page_size).all()
    )

    return PaginatedAttendanceResponse(
        items=[AttendanceRecordOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def productivity_by_department(db: Session) -> List[DepartmentProductivity]:
    """
    For each department, compute average attendance_rate and average_daily_output
    across its active workers.  Powers the "Department Comparison" dashboard chart.
    """
    departments = (
        db.query(distinct(Worker.department))
        .filter(Worker.is_active == True)
        .all()
    )

    result: List[DepartmentProductivity] = []
    for (dept,) in departments:
        workers = (
            db.query(Worker)
            .filter(Worker.department == dept, Worker.is_active == True)
            .all()
        )
        rates = []
        outputs = []
        for w in workers:
            stats = _compute_productivity(db, w.id)
            if stats["attendance_rate"] is not None:
                rates.append(stats["attendance_rate"])
            if stats["average_daily_output"] is not None:
                outputs.append(stats["average_daily_output"])

        result.append(DepartmentProductivity(
            department=dept,
            active_workers=len(workers),
            average_attendance_rate=round(sum(rates) / len(rates), 1) if rates else None,
            average_daily_output=round(sum(outputs) / len(outputs), 1) if outputs else None,
        ))

    result.sort(key=lambda d: d.department)
    return result


def create_worker(db: Session, body: WorkerCreate) -> Worker:
    worker = Worker(**body.model_dump())
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


def update_worker(db: Session, worker_id: int, body: WorkerUpdate) -> Worker:
    worker = _get_or_404(db, worker_id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(worker, field, value)
    db.commit()
    db.refresh(worker)
    return worker


def delete_worker(db: Session, worker_id: int) -> dict:
    """
    Soft-delete if the worker has any historical records (attendance,
    batch/stage assignments).  Only hard-delete if completely clean.
    """
    worker = _get_or_404(db, worker_id)

    has_history = (
        db.query(Attendance.id).filter(Attendance.worker_id == worker_id).first() is not None
        or db.query(BatchWorker.batch_id).filter(BatchWorker.worker_id == worker_id).first() is not None
        or db.query(StageWorker.stage_id).filter(StageWorker.worker_id == worker_id).first() is not None
    )

    if has_history:
        worker.is_active = False
        db.commit()
        db.refresh(worker)
        return {
            "message": f"Worker {worker_id} deactivated (soft-delete). Historical records preserved.",
            "is_active": False,
        }
    else:
        db.delete(worker)
        db.commit()
        return {"message": f"Worker {worker_id} deleted successfully."}
