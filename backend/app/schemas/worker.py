"""
Pydantic schemas for the Workers API.

WorkerCreate        -- POST body
WorkerUpdate        -- PUT body (all optional)
WorkerOut           -- base response shape
WorkerDetail        -- extends with computed productivity stats
AttendanceRecordOut -- single attendance row
DepartmentProductivity -- aggregated stats per department
PaginatedWorkerResponse      -- paginated list
PaginatedAttendanceResponse  -- paginated attendance list
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.enums import AttendanceStatus


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class WorkerCreate(BaseModel):
    name: str
    department: str    # Cutting, Printing, Embroidery, Stitching, Quality Check, Ironing, Packing
    skill: Optional[str] = None
    is_active: bool = True


class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    skill: Optional[str] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Response shapes
# ---------------------------------------------------------------------------

class WorkerOut(BaseModel):
    id: int
    name: str
    department: str
    skill: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkerDetail(WorkerOut):
    """GET /workers/{id} -- includes computed productivity stats."""
    attendance_rate: Optional[float] = None          # percentage 0-100
    total_output_last_30_days: Optional[int] = None
    average_daily_output: Optional[float] = None


class AttendanceRecordOut(BaseModel):
    id: int
    worker_id: int
    date: date
    status: AttendanceStatus
    overtime_hours: float
    output_quantity: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentProductivity(BaseModel):
    """Aggregated stats for one department."""
    department: str
    active_workers: int
    average_attendance_rate: Optional[float] = None    # percentage 0-100
    average_daily_output: Optional[float] = None


# ---------------------------------------------------------------------------
# Paginated wrappers
# ---------------------------------------------------------------------------

class PaginatedWorkerResponse(BaseModel):
    items: List[WorkerOut]
    total: int
    page: int
    page_size: int


class PaginatedAttendanceResponse(BaseModel):
    items: List[AttendanceRecordOut]
    total: int
    page: int
    page_size: int
