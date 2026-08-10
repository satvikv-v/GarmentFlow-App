"""
Production service layer — all DB logic for batches and stages.

Functions
---------
_next_batch_number      — collision-proof BATCH-NNNN generator
_assert_order           — 404 if order_id doesn't exist
_assert_no_active_batch — 409 if the order already has a non-cancelled batch
_validate_workers       — 404/422 if any worker_id is missing or inactive
_build_batch_out        — assembles BatchOut (including computed fields) from ORM row
list_batches            — paginated, filterable by status / order_id
get_batch               — single batch, 404 if missing
create_batch            — full validation + stage pipeline creation (mirrors seed_production)
update_stage            — PATCH one stage; auto-set completion_time; auto-flip batch on last complete
delete_batch            — hard delete, 409 if child FK rows block it
"""

from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import cast, func, Integer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.enums import (
    BatchStatus,
    OrderStatus,
    STAGE_SEQUENCE,
    StageStatus,
)
from app.models.order import Order
from app.models.production import BatchWorker, ProductionBatch, ProductionStage
from app.models.worker import Worker
from app.schemas.production import (
    BatchCreate,
    BatchOut,
    PaginatedBatchResponse,
    StageOut,
    StageUpdate,
    WorkerSlim,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _next_batch_number(db: Session) -> str:
    """Return the next unused BATCH-NNNN (highest existing suffix + 1)."""
    max_num = (
        db.query(
            func.max(cast(func.split_part(ProductionBatch.batch_number, "-", 2), Integer))
        ).scalar()
    )
    return f"BATCH-{(max_num or 0) + 1}"


def _assert_order(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found.",
        )
    return order


def _assert_no_active_batch(db: Session, order_id: int) -> None:
    """Raise 409 if a non-cancelled batch already exists for this order."""
    existing = (
        db.query(ProductionBatch)
        .filter(
            ProductionBatch.order_id == order_id,
            ProductionBatch.status != BatchStatus.ON_HOLD,  # ON_HOLD = cancelled in seed
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Order {order_id} already has an active batch "
                f"({existing.batch_number}, status={existing.status.value}). "
                "Cancel or delete it before creating a new one."
            ),
        )


def _validate_workers(db: Session, worker_ids: List[int]) -> List[Worker]:
    """Return validated Worker rows; raise 422 for unknown ids, 422 for inactive."""
    if not worker_ids:
        return []
    workers = db.query(Worker).filter(Worker.id.in_(worker_ids)).all()
    found_ids = {w.id for w in workers}
    missing = set(worker_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Worker id(s) not found: {sorted(missing)}.",
        )
    inactive = [w for w in workers if not w.is_active]
    if inactive:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Worker(s) {[w.id for w in inactive]} are inactive "
                "and cannot be assigned to a batch."
            ),
        )
    return workers


def _build_batch_out(batch: ProductionBatch) -> BatchOut:
    """
    Assemble a BatchOut from a fully-loaded ORM row.

    Computed fields:
    - remaining_production  — reuses the model @property directly
    - daily_production_target — planned_quantity / days_remaining (min 1 day)
    """
    today = date.today()
    if batch.expected_completion_date and batch.expected_completion_date > today:
        days_remaining = (batch.expected_completion_date - today).days
    else:
        days_remaining = 1  # past or unknown deadline → target is the full qty per day

    daily_target = max(1, batch.planned_quantity // max(days_remaining, 1))

    workers = [
        WorkerSlim.model_validate(bw.worker)
        for bw in batch.worker_assignments
        if bw.worker is not None
    ]
    stages = [StageOut.model_validate(s) for s in batch.stages]

    return BatchOut(
        id=batch.id,
        batch_number=batch.batch_number,
        order_id=batch.order_id,
        production_line=batch.production_line,
        planned_quantity=batch.planned_quantity,
        expected_completion_date=batch.expected_completion_date,
        status=batch.status,
        stages=stages,
        assigned_workers=workers,
        remaining_production=batch.remaining_production,
        daily_production_target=daily_target,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
    )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def list_batches(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[BatchStatus] = None,
    order_id: Optional[int] = None,
) -> PaginatedBatchResponse:
    query = db.query(ProductionBatch)
    if status_filter is not None:
        query = query.filter(ProductionBatch.status == status_filter)
    if order_id is not None:
        query = query.filter(ProductionBatch.order_id == order_id)

    total: int = query.with_entities(func.count(ProductionBatch.id)).scalar()
    offset = (page - 1) * page_size
    rows = query.order_by(ProductionBatch.id).offset(offset).limit(page_size).all()

    return PaginatedBatchResponse(
        items=[_build_batch_out(b) for b in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_batch(db: Session, batch_id: int) -> BatchOut:
    batch = db.query(ProductionBatch).filter(ProductionBatch.id == batch_id).first()
    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production batch {batch_id} not found.",
        )
    return _build_batch_out(batch)


def create_batch(db: Session, body: BatchCreate) -> BatchOut:
    """
    Validate order + workers, generate batch number, create the batch,
    then auto-generate the full stage pipeline (mirrors seed_production exactly).
    """
    _assert_order(db, body.order_id)
    _assert_no_active_batch(db, body.order_id)
    workers = _validate_workers(db, body.assigned_worker_ids)

    batch = ProductionBatch(
        batch_number=_next_batch_number(db),
        order_id=body.order_id,
        production_line=body.production_line,
        planned_quantity=body.planned_quantity,
        expected_completion_date=body.expected_completion_date,
        status=BatchStatus.PLANNED,
    )
    db.add(batch)
    db.flush()  # get batch.id before creating stages

    # Assign workers to the batch overall
    for w in workers:
        db.add(BatchWorker(batch_id=batch.id, worker_id=w.id))

    # Build the full stage pipeline — mirrors seed_production() exactly,
    # including optional-embroidery handling
    include_stages = [
        s for s in STAGE_SEQUENCE
        if not (body.skip_embroidery and s.value == "embroidery")
    ]
    for stage_name in include_stages:
        seq = STAGE_SEQUENCE.index(stage_name) + 1
        db.add(ProductionStage(
            batch_id=batch.id,
            stage_name=stage_name,
            sequence_order=seq,
            status=StageStatus.PENDING,
            quantity_completed=0,
        ))

    db.commit()
    db.refresh(batch)
    return _build_batch_out(batch)


def update_stage(
    db: Session,
    batch_id: int,
    stage_id: int,
    body: StageUpdate,
) -> BatchOut:
    """
    PATCH one stage's progress fields.

    Auto-behaviours:
    - If status is set to COMPLETED and no completion_time supplied → set now().
    - If status is set to COMPLETED and this is the last non-skipped stage
      in the pipeline → flip the parent batch to COMPLETED as well.
    """
    # Confirm batch exists
    batch = db.query(ProductionBatch).filter(ProductionBatch.id == batch_id).first()
    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production batch {batch_id} not found.",
        )

    stage = (
        db.query(ProductionStage)
        .filter(
            ProductionStage.id == stage_id,
            ProductionStage.batch_id == batch_id,
        )
        .first()
    )
    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} not found on batch {batch_id}.",
        )

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(stage, field, value)

    # Auto-set completion_time when marking completed
    if body.status == StageStatus.COMPLETED:
        if not stage.completion_time:
            stage.completion_time = datetime.now(timezone.utc).replace(tzinfo=None)

        # Check whether this is the last active stage in the pipeline
        other_stages = [s for s in batch.stages if s.id != stage_id]
        all_done = all(
            s.status in (StageStatus.COMPLETED, StageStatus.SKIPPED)
            for s in other_stages
        )
        if all_done:
            batch.status = BatchStatus.COMPLETED

    db.commit()
    db.refresh(batch)
    return _build_batch_out(batch)


def delete_batch(db: Session, batch_id: int) -> dict:
    """Hard-delete a batch.  409 if FK children block deletion."""
    batch = db.query(ProductionBatch).filter(ProductionBatch.id == batch_id).first()
    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production batch {batch_id} not found.",
        )
    try:
        db.delete(batch)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Batch {batch_id} has linked records (dispatch, inventory transactions). "
                "Remove those first."
            ),
        )
    return {"message": f"Batch {batch_id} deleted successfully."}
