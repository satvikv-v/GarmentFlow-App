"""
Production router — batch CRUD + stage progress patching + delay risk prediction.

GET    /production/batches                         paginated list (any auth'd user)
GET    /production/batches/{id}                    full detail (any auth'd user)
POST   /production/batches                         create batch (OWNER, PRODUCTION_MANAGER)
PATCH  /production/batches/{id}/stages/{sid}       update stage progress (OWNER, PRODUCTION_MANAGER)
DELETE /production/batches/{id}                    hard delete (OWNER only)
GET    /production/batches/{id}/delay-risk         ML delay risk prediction (any auth'd user)
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.ml import predictor
from app.models.enums import BatchStatus, UserRole
from app.models.production import ProductionBatch
from app.models.user import User
from app.schemas.ml import DelayRiskResponse
from app.schemas.production import (
    BatchCreate,
    BatchOut,
    PaginatedBatchResponse,
    StageUpdate,
)
from app.services import production_service

router = APIRouter(prefix="/production", tags=["production"])

# Dependency aliases
AnyUser = Annotated[User, Depends(get_current_user)]
OwnerOrProd = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.PRODUCTION_MANAGER)),
]
OwnerOnly = Annotated[User, Depends(require_role(UserRole.OWNER))]
DB = Annotated[Session, Depends(get_db)]


@router.get("/batches", response_model=PaginatedBatchResponse)
def list_batches(
    _: AnyUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[BatchStatus] = Query(None, description="Filter by batch status"),
    order_id: Optional[int] = Query(None, description="Filter by order"),
) -> PaginatedBatchResponse:
    """Paginated production batch list with optional status/order_id filters."""
    return production_service.list_batches(
        db, page=page, page_size=page_size,
        status_filter=status, order_id=order_id,
    )


@router.get("/batches/{batch_id}", response_model=BatchOut)
def get_batch(
    batch_id: int,
    _: AnyUser,
    db: DB,
) -> BatchOut:
    """Full batch detail including stages and assigned workers.  404 if missing."""
    return production_service.get_batch(db, batch_id)


@router.post(
    "/batches",
    response_model=BatchOut,
    status_code=status.HTTP_201_CREATED,
)
def create_batch(
    body: BatchCreate,
    _: OwnerOrProd,
    db: DB,
) -> BatchOut:
    """
    Create a production batch for an order.
    Restricted to OWNER and PRODUCTION_MANAGER.

    Enforced by the service layer:
    - order_id must exist (404)
    - order must not already have an active batch (409)
    - all assigned_worker_ids must be valid and active (422)
    - full stage pipeline (9 or 8 stages) is auto-generated
    """
    return production_service.create_batch(db, body)


@router.patch(
    "/batches/{batch_id}/stages/{stage_id}",
    response_model=BatchOut,
)
def update_stage(
    batch_id: int,
    stage_id: int,
    body: StageUpdate,
    _: OwnerOrProd,
    db: DB,
) -> BatchOut:
    """
    Update one stage's progress.  Returns the full updated batch.
    Restricted to OWNER and PRODUCTION_MANAGER.

    Auto-behaviours:
    - status=completed with no completion_time → completion_time set to now
    - last stage completed → parent batch status flipped to completed
    """
    return production_service.update_stage(db, batch_id, stage_id, body)


@router.delete("/batches/{batch_id}", status_code=status.HTTP_200_OK)
def delete_batch(
    batch_id: int,
    _: OwnerOnly,
    db: DB,
) -> dict:
    """Hard-delete a batch.  OWNER only.  409 if linked dispatch/inventory blocks it."""
    return production_service.delete_batch(db, batch_id)


@router.get("/batches/{batch_id}/delay-risk", response_model=DelayRiskResponse)
def get_batch_delay_risk(
    batch_id: int,
    _: AnyUser,
    db: DB,
) -> DelayRiskResponse:
    """
    Predict the delay risk for a production batch.

    Returns the predicted risk level (LOW | MEDIUM | HIGH), the raw
    probability, up to 3 contributing factors, and an honest caveat
    about model limitations.

    Requires any authenticated user.  Returns 401 without a valid token,
    404 if the batch doesn't exist, and 503 if the model hasn't been
    trained yet (run: python -m app.ml.train_delay_model).

    Note: this model is trained on ~100 seeded batches using only
    early-signal features (no label-leaking has_delayed_stage).  Treat
    the output as a flag for human review, not a definitive forecast.
    """
    # 503 if model isn't loaded
    if not predictor.is_model_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Delay risk model not available: {predictor.get_model_error()}. "
                "Run: python -m app.ml.train_delay_model"
            ),
        )

    # 404 if batch doesn't exist
    batch = db.query(ProductionBatch).filter(ProductionBatch.id == batch_id).first()
    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production batch {batch_id} not found.",
        )

    prediction = predictor.predict_delay_risk(batch)
    return DelayRiskResponse(
        batch_id=batch_id,
        **prediction,
    )
