"""
Dashboard router.

GET /dashboard/summary   — any authenticated user
    Returns a single aggregated snapshot of the current factory state.
    All metrics are computed with aggregate SQL (no N+1 queries).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

AnyUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    _: AnyUser,
    db: DB,
) -> DashboardSummary:
    """
    Aggregated factory snapshot.

    Accessible to any authenticated user (all roles).
    All values are computed with single-pass SQL aggregate queries;
    the endpoint should respond in well under 100 ms on a local DB.
    """
    return dashboard_service.get_summary(db)
