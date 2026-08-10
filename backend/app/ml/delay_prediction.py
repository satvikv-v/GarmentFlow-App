"""
Feature engineering for batch delay risk prediction.

build_training_dataframe(db)
    Queries all production batches that are eligible for training
    (i.e., not PENDING-order/no-batch, not ON_HOLD/cancelled).
    Returns a pandas DataFrame with one row per batch, containing
    both the feature matrix and the binary label column 'is_delayed'.

extract_features(batch)
    Extracts features for a single ProductionBatch ORM row.
    Used at inference time (one batch at a time).

Label definition
----------------
    is_delayed = 1  if batch.status == 'delayed'
                    OR any stage in batch has status == 'delayed'

    We use the OR because:
    - In seeded data both always co-occur (when batch is DELAYED,
      its active stage is also set to DELAYED).
    - Using OR future-proofs against batches created via the API
      where only one side may be set.

Feature set
-----------
    order_quantity          — batch.planned_quantity
    assigned_worker_count   — number of rows in batch.worker_assignments
    days_since_created      — (today - batch.created_at).days
    stages_completed_ratio  — completed_stages / total_stages
    has_delayed_stage       — 1 if any stage.status == 'delayed'  ← leakage candidate
    production_line         — categorical: "Line A", "Line B", "Line C"

Note on has_delayed_stage leakage
----------------------------------
    This feature is set simultaneously with the label in the seeded data,
    so it constitutes label leakage — the model would be detecting delay
    after the fact, not predicting it from early signals.  The training
    script trains two models (with / without this feature) and reports
    both; the API always uses the leakage-free model.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import pandas as pd
from sqlalchemy.orm import Session

from app.models.enums import BatchStatus, StageStatus
from app.models.production import ProductionBatch


# --------------------------------------------------------------------------- #
# Constants                                                                     #
# --------------------------------------------------------------------------- #

# Feature names used by the leakage-free model (what the API loads).
LEAKAGE_FREE_FEATURES: List[str] = [
    "order_quantity",
    "assigned_worker_count",
    "stages_completed_ratio",
    "production_line_Line B",
    "production_line_Line C",
]

# All features including the leakage candidate.
ALL_FEATURES: List[str] = [
    "order_quantity",
    "assigned_worker_count",
    "stages_completed_ratio",
    "has_delayed_stage",
    "production_line_Line B",
    "production_line_Line C",
]

LABEL_COL = "is_delayed"


# --------------------------------------------------------------------------- #
# Single-batch feature extraction                                               #
# --------------------------------------------------------------------------- #

def extract_features(batch: ProductionBatch) -> Dict[str, float]:
    """
    Extract the raw feature dict for a single batch.

    Returned keys match the columns produced by build_training_dataframe,
    *before* one-hot encoding of production_line.
    """
    total_stages = len(batch.stages)
    completed_stages = sum(
        1 for s in batch.stages
        if s.status in (StageStatus.COMPLETED, StageStatus.SKIPPED)
    )
    stages_completed_ratio = (
        completed_stages / total_stages if total_stages > 0 else 0.0
    )

    has_delayed_stage = int(
        any(s.status == StageStatus.DELAYED for s in batch.stages)
    )

    return {
        "order_quantity": batch.planned_quantity,
        "assigned_worker_count": len(batch.worker_assignments),
        "stages_completed_ratio": round(stages_completed_ratio, 4),
        "has_delayed_stage": has_delayed_stage,
        "production_line": batch.production_line or "Unknown",
    }


# --------------------------------------------------------------------------- #
# Training dataset builder                                                      #
# --------------------------------------------------------------------------- #

def _is_delayed_label(batch: ProductionBatch) -> int:
    """
    Binary label: 1 if the batch is (or was) delayed, 0 otherwise.

    Uses OR of batch-level and any stage-level delayed status.
    """
    if batch.status == BatchStatus.DELAYED:
        return 1
    if any(s.status == StageStatus.DELAYED for s in batch.stages):
        return 1
    return 0


def build_training_dataframe(db: Session) -> Tuple[pd.DataFrame, pd.Series, List[str]]:
    """
    Build the full training dataset from the database.

    Returns
    -------
    df_features : pd.DataFrame
        One row per batch, one column per feature (including one-hot encoded
        production_line).  Two versions can be sliced using LEAKAGE_FREE_FEATURES
        and ALL_FEATURES constants.
    labels : pd.Series
        Binary series (0/1) aligned with df_features.
    raw_df : pd.DataFrame
        Pre-one-hot DataFrame with the original production_line string, useful
        for printing distributions.
    """
    # Fetch all batches — filter out batches from PENDING orders (no production
    # started yet) and ON_HOLD batches (effectively cancelled / irrelevant).
    batches = (
        db.query(ProductionBatch)
        .filter(
            ProductionBatch.status.notin_([BatchStatus.ON_HOLD])
        )
        .all()
    )

    rows = []
    for batch in batches:
        feats = extract_features(batch)
        feats[LABEL_COL] = _is_delayed_label(batch)
        rows.append(feats)

    if not rows:
        raise ValueError("No eligible batches found in the database. Have you run seed.py?")

    raw_df = pd.DataFrame(rows)

    # One-hot encode production_line (drop_first=True → Line A is the reference)
    dummies = pd.get_dummies(raw_df["production_line"], prefix="production_line", drop_first=True)
    df_features = pd.concat(
        [raw_df.drop(columns=["production_line", LABEL_COL]), dummies],
        axis=1,
    )
    # Ensure all expected dummy columns exist even if a category is missing
    for col in ["production_line_Line B", "production_line_Line C"]:
        if col not in df_features.columns:
            df_features[col] = 0

    labels = raw_df[LABEL_COL].astype(int)
    return df_features, labels, raw_df


# --------------------------------------------------------------------------- #
# Distribution reporter (called from train script and when run directly)        #
# --------------------------------------------------------------------------- #

def print_distributions(raw_df: pd.DataFrame) -> None:
    """Print feature distributions and class balance to stdout."""
    n = len(raw_df)
    delayed = raw_df[LABEL_COL].sum()
    pct = 100 * delayed / n if n > 0 else 0.0

    print("\n" + "=" * 60)
    print("DATASET OVERVIEW")
    print("=" * 60)
    print(f"  Total eligible batches : {n}")
    print(f"  Delayed (label=1)      : {int(delayed)}  ({pct:.1f}%)")
    print(f"  Not delayed (label=0)  : {n - int(delayed)}  ({100 - pct:.1f}%)")

    print("\nFEATURE DISTRIBUTIONS")
    print("-" * 60)
    numeric_cols = [
        "order_quantity", "assigned_worker_count",
        "stages_completed_ratio",
        "has_delayed_stage",
    ]
    for col in numeric_cols:
        s = raw_df[col]
        print(
            f"  {col:<28}  "
            f"mean={s.mean():.2f}  std={s.std():.2f}  "
            f"min={s.min():.0f}  max={s.max():.0f}"
        )

    print("\n  production_line distribution:")
    for val, cnt in raw_df["production_line"].value_counts().items():
        print(f"    {val:<12}  {cnt} batches")
    print("=" * 60)


# --------------------------------------------------------------------------- #
# Direct-run: inspect the dataset before training                               #
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    from app.database.session import SessionLocal

    db = SessionLocal()
    try:
        _, _, raw_df = build_training_dataframe(db)
        print_distributions(raw_df)
    finally:
        db.close()
