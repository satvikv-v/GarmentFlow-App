"""
Workers router -- CRUD + productivity + attendance history.

GET    /workers                              paginated list (any auth'd user)
GET    /workers/productivity/by-department    department aggregation (any auth'd user)
GET    /workers/{id}                         detail with computed productivity
GET    /workers/{id}/attendance              attendance history, most recent first
POST   /workers                              create (OWNER, PRODUCTION_MANAGER)
PUT    /workers/{id}                         update (OWNER, PRODUCTION_MANAGER)
DELETE /workers/{id}                         soft/hard delete (OWNER only)
"""

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.worker import (
    DepartmentProductivity,
    PaginatedAttendanceResponse,
    PaginatedWorkerResponse,
    WorkerCreate,
    WorkerDetail,
    WorkerOut,
    WorkerUpdate,
)
from app.services import worker_service

router = APIRouter(prefix="/workers", tags=["workers"])

# Dependency aliases
AnyUser = Annotated[User, Depends(get_current_user)]
OwnerOrProd = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.PRODUCTION_MANAGER)),
]
OwnerOnly = Annotated[User, Depends(require_role(UserRole.OWNER))]
DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=PaginatedWorkerResponse)
def list_workers(
    _: AnyUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
) -> PaginatedWorkerResponse:
    return worker_service.list_workers(
        db, page=page, page_size=page_size,
        department=department, is_active=is_active,
    )


# NOTE: this route MUST come before /{id} to avoid FastAPI interpreting
# "productivity" as a worker id.
@router.get("/productivity/by-department", response_model=List[DepartmentProductivity])
def productivity_by_department(
    _: AnyUser,
    db: DB,
) -> List[DepartmentProductivity]:
    """Average attendance_rate and daily_output per department (active workers)."""
    return worker_service.productivity_by_department(db)


@router.get("/{worker_id}", response_model=WorkerDetail)
def get_worker(
    worker_id: int,
    _: AnyUser,
    db: DB,
) -> WorkerDetail:
    """Detail with computed productivity stats from real attendance data."""
    return worker_service.get_worker_detail(db, worker_id)


@router.get("/{worker_id}/attendance", response_model=PaginatedAttendanceResponse)
def list_attendance(
    worker_id: int,
    _: AnyUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedAttendanceResponse:
    """Attendance history for one worker, most recent first."""
    return worker_service.list_attendance(
        db, worker_id, page=page, page_size=page_size,
    )


@router.post("", response_model=WorkerOut, status_code=status.HTTP_201_CREATED)
def create_worker(
    body: WorkerCreate,
    _: OwnerOrProd,
    db: DB,
) -> WorkerOut:
    return worker_service.create_worker(db, body)


@router.put("/{worker_id}", response_model=WorkerOut)
def update_worker(
    worker_id: int,
    body: WorkerUpdate,
    _: OwnerOrProd,
    db: DB,
) -> WorkerOut:
    return worker_service.update_worker(db, worker_id, body)


@router.delete("/{worker_id}", status_code=status.HTTP_200_OK)
def delete_worker(
    worker_id: int,
    _: OwnerOnly,
    db: DB,
) -> dict:
    """Soft-delete (deactivate) if worker has history; hard-delete otherwise."""
    return worker_service.delete_worker(db, worker_id)
