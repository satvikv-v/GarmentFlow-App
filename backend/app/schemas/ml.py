"""
Pydantic schemas for ML/AI features.

DelayRiskResponse       -- GET /production/batches/{id}/delay-risk
InventoryForecastResponse -- GET /inventory/items/{id}/forecast
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.enums import DelayRisk


class DelayRiskResponse(BaseModel):
    """
    Response body for the delay risk prediction endpoint.

    Fields
    ------
    batch_id
        The batch this prediction applies to.
    risk
        Bucketed risk level: LOW | MEDIUM | HIGH.
        Thresholds: <35% -> LOW, 35-65% -> MEDIUM, >=65% -> HIGH.
        The MEDIUM band is intentionally wide given the small training set.
    probability
        Raw model output probability [0.0, 1.0] that this batch will be delayed.
        Shown for transparency; the bucketed risk is the primary output.
    contributing_factors
        Human-readable list of up to 3 features that are pushing the probability
        upward.  Derived from logistic regression coefficients x feature values.
        Empty (replaced with a neutral message) when no strong risk signals exist.
    model_note
        Honest caveat about the model's limitations.  Always present.
    """

    batch_id: int
    risk: DelayRisk = Field(
        ...,
        description="LOW | MEDIUM | HIGH -- bucketed from probability",
    )
    probability: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Raw predicted probability of delay [0.0, 1.0]",
    )
    contributing_factors: List[str] = Field(
        default_factory=list,
        description="Top risk-increasing signals in human-readable form",
    )
    model_note: str = Field(
        ...,
        description="Honest caveat about model limitations and training data size",
    )

    model_config = {"protected_namespaces": ()}


class InventoryForecastResponse(BaseModel):
    """
    Response body for GET /inventory/items/{id}/forecast.

    Approach: consumption-rate heuristic (not time-series).
    The seeded transaction data all falls within a single 7-hour window,
    making time-series forecasting meaningless.  This endpoint computes:

        avg_qty_per_batch = total_issued / n_issue_transactions
        estimated_demand  = avg_qty_per_batch * open_batch_count
        suggested_reorder = max(0, estimated_demand - (current_stock - minimum_stock))

    Items with no issue history return null for demand/reorder fields with a
    clear explanation rather than a fabricated number.
    """

    item_id: int
    item_name: str
    unit: str

    # Current state
    current_stock: float = Field(description="Current stock level")
    minimum_stock: float = Field(description="Safety stock threshold")

    # Heuristic inputs (always shown for transparency)
    n_issue_transactions: int = Field(
        description="Number of historical issue transactions for this item"
    )
    total_issued: float = Field(
        description="Total quantity issued across all historical transactions"
    )
    avg_qty_per_batch: Optional[float] = Field(
        None,
        description="Average quantity issued per batch (null if no history)",
    )
    open_batch_count: int = Field(
        description="Number of currently open/in-progress production batches"
    )

    # Outputs (null when no history)
    estimated_demand: Optional[float] = Field(
        None,
        description=(
            "Estimated near-term consumption: avg_qty_per_batch * open_batch_count. "
            "Null if item has no issue history."
        ),
    )
    surplus_after_demand: Optional[float] = Field(
        None,
        description=(
            "current_stock minus estimated_demand. "
            "Negative means stock is expected to be insufficient."
        ),
    )
    suggested_reorder_qty: Optional[float] = Field(
        None,
        description=(
            "Quantity to order to cover estimated demand while keeping stock "
            "above minimum_stock.  0 if current stock is sufficient.  "
            "Null if no issue history."
        ),
    )

    # Meta
    has_history: bool = Field(
        description="False if no issue transactions exist for this item"
    )
    approach: str = Field(
        description="Plain-language description of the forecasting method used"
    )
    caveat: str = Field(
        description="Honest statement of data limitations affecting this forecast"
    )


class OrderRecommendationResponse(BaseModel):
    """
    Single order recommendation from GET /orders/recommendations.

    Approach: weighted-score heuristic across deadline urgency, order priority,
    order size, and fabric stock risk.  NOT a trained ML model.
    """

    order_id: int
    order_number: str
    product: str
    fabric: str
    quantity: int
    priority: str
    delivery_deadline: str     # ISO date string
    days_to_deadline: int
    current_status: str

    # Score breakdown (transparent)
    score: int = Field(description="0-100 composite priority score (higher = schedule sooner)")
    deadline_score: int = Field(description="0-40: urgency contribution")
    priority_score: int = Field(description="0-30: order priority contribution")
    size_score: int = Field(description="0-20: order size contribution")
    fabric_risk_score: int = Field(description="0-10: fabric shortage risk contribution")

    # Suggestions
    suggested_worker_count: int
    estimated_completion_date: str   # ISO date string
    days_to_complete: int
    buffer_days: int = Field(
        description=(
            "Days between estimated completion and deadline. "
            "Negative = estimated to finish AFTER deadline."
        )
    )

    # Batch info
    existing_batch_id: Optional[int] = None
    existing_batch_status: Optional[str] = None

    # Fabric check
    fabric_item_matched: bool
    fabric_item_name: Optional[str] = None
    fabric_stock_sufficient: Optional[bool] = Field(
        None,
        description="None if fabric not matched in inventory; True/False if matched"
    )

    # Human-readable outputs
    reason: str = Field(description="Plain-language explanation of score and flags")
    caveat: str = Field(description="Honest statement of heuristic limitations")


class PaginatedRecommendationResponse(BaseModel):
    """Wrapper for GET /orders/recommendations."""
    total: int
    items: List[OrderRecommendationResponse]
    approach: str = Field(
        default=(
            "Weighted-score heuristic (not ML): deadline urgency (0-40) + "
            "order priority (0-30) + order size (0-20) + fabric stock risk (0-10). "
            "No ground-truth label exists for 'correct scheduling order' in this "
            "dataset -- a trained model would be fabricating structure. "
            "Sorted by score descending, then deadline ascending."
        ),
        description="Description of the ranking method used"
    )

