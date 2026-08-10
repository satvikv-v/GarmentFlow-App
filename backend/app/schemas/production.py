"""
Pydantic schemas for the Production API.

BatchCreate          — POST body to open a new production batch
BatchOut             — full batch detail (includes computed fields + stages + workers)
StageOut             — single stage row (nested inside BatchOut)
WorkerSlim           — minimal worker info for the workers list inside BatchOut
StageUpdate          — PATCH body for updating one stage's progress
PaginatedBatchResponse — paginated list wrapper
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, computed_field

from app.models.enums import BatchStatus, StageName, StageStatus


# ---------------------------------------------------------------------------
# Nested shapes
# ---------------------------------------------------------------------------

class WorkerSlim(BaseModel):
    id: int
    name: str
    department: str

    model_config = {"from_attributes": True}


class StageOut(BaseModel):
    id: int
    stage_name: StageName
    sequence_order: int
    status: StageStatus
    start_time: Optional[datetime] = None
    completion_time: Optional[datetime] = None
    quantity_completed: int
    delay_reason: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class BatchCreate(BaseModel):
    order_id: int
    production_line: Optional[str] = None
    planned_quantity: int
    expected_completion_date: Optional[date] = None
    assigned_worker_ids: List[int] = []
    skip_embroidery: bool = False          # mirrors the seed pattern — optional stage


class StageUpdate(BaseModel):
    """PATCH body for a single stage.  All fields optional."""
    status: Optional[StageStatus] = None
    quantity_completed: Optional[int] = None
    delay_reason: Optional[str] = None
    notes: Optional[str] = None
    # Caller may supply completion_time; if omitted and status==COMPLETED the
    # service layer sets it to now() automatically.
    completion_time: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Response shapes
# ---------------------------------------------------------------------------

class BatchOut(BaseModel):
    id: int
    batch_number: str
    order_id: int
    production_line: Optional[str] = None
    planned_quantity: int
    expected_completion_date: Optional[date] = None
    status: BatchStatus

    # Stages ordered by sequence_order (the relationship already does this)
    stages: List[StageOut] = []

    # Workers assigned to the batch overall (via BatchWorker join)
    assigned_workers: List[WorkerSlim] = []

    # Computed at serialisation time — pulled from the ORM model property /
    # calculated inline so we never have stale values.
    remaining_production: int = 0
    daily_production_target: int = 0

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedBatchResponse(BaseModel):
    items: List[BatchOut]
    total: int
    page: int
    page_size: int
