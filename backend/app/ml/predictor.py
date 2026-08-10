"""
Model loader and inference engine for batch delay risk prediction.

This module owns the model lifecycle:
    load_model()           — reads app/ml/model.pkl once at API startup
    predict_delay_risk()   — inference for a single ProductionBatch ORM row

The loaded model is a scikit-learn Pipeline:
    StandardScaler  ->  LogisticRegression(class_weight='balanced')

Trained on 4 leakage-free features (no has_delayed_stage, no days_since_created):
    order_quantity, assigned_worker_count, stages_completed_ratio,
    production_line (one-hot: Line B, Line C)

Risk bucketing thresholds
--------------------------
    probability < 0.35   ->  LOW
    0.35 <= prob < 0.65  ->  MEDIUM
    probability >= 0.65  ->  HIGH

The MEDIUM band is intentionally wide because the training dataset is
small (~100 rows) and we should not project high confidence in either
direction that the data doesn't support.

contributing_factors
---------------------
Derived from logistic regression coefficients × standardized feature value.
The top-3 positive contributors (features that pushed probability upward)
are returned as human-readable strings.  Negative contributors (features
that lowered risk) are omitted from the list but noted in model_note.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np
import pandas as pd

from app.ml.delay_prediction import (
    LEAKAGE_FREE_FEATURES,
    extract_features,
)
from app.models.enums import DelayRisk
from app.models.production import ProductionBatch

MODEL_PATH = Path(__file__).parent / "model.pkl"

# Module-level singleton: loaded once at startup, reused for all requests.
_MODEL = None
_MODEL_LOAD_ERROR: Optional[str] = None


# --------------------------------------------------------------------------- #
# Startup loader                                                                #
# --------------------------------------------------------------------------- #

def load_model() -> None:
    """
    Load the pickled sklearn Pipeline from disk into the module-level singleton.

    Called once during FastAPI lifespan startup.  If the file doesn't exist,
    stores an error string so the endpoint can return 503 with a clear message
    rather than letting the server crash.
    """
    global _MODEL, _MODEL_LOAD_ERROR
    if not MODEL_PATH.exists():
        _MODEL_LOAD_ERROR = (
            f"Model file not found at {MODEL_PATH}. "
            "Run: python -m app.ml.train_delay_model"
        )
        print(f"[!] Delay risk model NOT loaded: {_MODEL_LOAD_ERROR}")
        return
    try:
        _MODEL = joblib.load(MODEL_PATH)
        _MODEL_LOAD_ERROR = None
        print(f"[OK] Delay risk model loaded from {MODEL_PATH}")
    except Exception as exc:
        _MODEL_LOAD_ERROR = f"Failed to load model: {exc}"
        print(f"[!] Delay risk model load error: {_MODEL_LOAD_ERROR}")


def is_model_ready() -> bool:
    return _MODEL is not None


def get_model_error() -> Optional[str]:
    return _MODEL_LOAD_ERROR


# --------------------------------------------------------------------------- #
# Inference                                                                     #
# --------------------------------------------------------------------------- #

def _probability_to_risk(prob: float) -> DelayRisk:
    if prob >= 0.65:
        return DelayRisk.HIGH
    elif prob >= 0.35:
        return DelayRisk.MEDIUM
    else:
        return DelayRisk.LOW


def _get_contributing_factors(pipeline, feature_values: dict) -> List[str]:
    """
    Return top contributing factors as human-readable strings.

    Method: logistic regression coefficient × (value - mean) / std
    (i.e., the contribution in the standardized space).
    Positive contributions raise the predicted probability.
    """
    clf = pipeline.named_steps["clf"]
    scaler = pipeline.named_steps["scaler"]

    coefs = clf.coef_[0]
    feature_names = LEAKAGE_FREE_FEATURES

    # Build feature vector in the same order as training
    feat_values = np.array([feature_values.get(f, 0.0) for f in feature_names], dtype=float)

    # Standardized values
    means = scaler.mean_
    stds = scaler.scale_
    standardized = (feat_values - means) / (stds + 1e-9)

    # Contribution = coef × standardized_value
    contributions = coefs * standardized

    # Readable factor labels
    FACTOR_LABELS = {
        "order_quantity": "large order quantity",
        "assigned_worker_count": "worker count",
        "stages_completed_ratio": "production progress",
        "production_line_Line B": "production line (Line B)",
        "production_line_Line C": "production line (Line C)",
    }

    MAGNITUDE_LABELS = [(0.5, "strongly"), (0.2, "moderately"), (0.0, "slightly")]

    factors = []
    # Sort by descending contribution (most positive first)
    for idx in np.argsort(-contributions):
        cont = contributions[idx]
        if cont <= 0:
            break  # Only report positive (risk-increasing) factors
        fname = feature_names[idx]
        label = FACTOR_LABELS.get(fname, fname)
        mag = next(m for threshold, m in MAGNITUDE_LABELS if cont > threshold)
        direction = "increases" if cont > 0 else "reduces"
        factors.append(f"{label} {mag} {direction} delay risk")
        if len(factors) >= 3:
            break

    if not factors:
        factors = ["No strong risk signals detected in current batch state"]

    return factors


def predict_delay_risk(batch: ProductionBatch) -> dict:
    """
    Run inference for one batch.

    Returns a dict with keys:
        risk               : DelayRisk (LOW | MEDIUM | HIGH)
        probability        : float  [0.0, 1.0]
        contributing_factors : list[str]
        model_note         : str
    """
    if _MODEL is None:
        raise RuntimeError(_MODEL_LOAD_ERROR or "Model not loaded.")

    # Extract raw features (includes has_delayed_stage + production_line string)
    raw_feats = extract_features(batch)

    # One-hot encode production_line -- mirrors training preprocessing
    prod_line = raw_feats.get("production_line", "Unknown")
    feature_dict = {
        "order_quantity": float(raw_feats["order_quantity"]),
        "assigned_worker_count": float(raw_feats["assigned_worker_count"]),
        "stages_completed_ratio": float(raw_feats["stages_completed_ratio"]),
        "production_line_Line B": 1.0 if prod_line == "Line B" else 0.0,
        "production_line_Line C": 1.0 if prod_line == "Line C" else 0.0,
    }

    X = pd.DataFrame([feature_dict])[LEAKAGE_FREE_FEATURES]
    prob = float(_MODEL.predict_proba(X)[0, 1])
    risk = _probability_to_risk(prob)
    factors = _get_contributing_factors(_MODEL, feature_dict)

    return {
        "risk": risk,
        "probability": round(prob, 4),
        "contributing_factors": factors,
        "model_note": (
            "Model trained on ~100 seeded batches without label-leaking features. "
            "Metrics are directional; treat HIGH risk as a flag for review, not a certainty. "
            "Retrain with more production history for reliable predictions."
        ),
    }
