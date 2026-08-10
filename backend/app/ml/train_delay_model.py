# -*- coding: utf-8 -*-
"""
Offline training script for the GarmentFlow batch delay risk model.

Run from the backend/ directory:
    python -m app.ml.train_delay_model

What this script does
----------------------
1.  Connects to the database and calls build_training_dataframe() to get
    the full feature matrix and labels from the seeded data.
2.  Prints class balance and per-feature distributions.
3.  Trains TWO Logistic Regression models on an 80/20 stratified split:

    Round 1  -  WITH  has_delayed_stage
        This feature is set at the same moment the batch is marked delayed
        in the seed data.  Including it gives inflated metrics -- the model
        is detecting delay *after it happened*, not predicting risk.

    Round 2  -  WITHOUT  has_delayed_stage  (leakage-free)
        This is the honest predictor.  It can only use signals that are
        knowable *before* the delay is logged: order size, worker count,
        how many stages have completed, how long the batch has been open,
        and which production line it is on.

4.  Reports accuracy / precision / recall / F1 / confusion matrix for both.
    Prints a plain comparison explaining what the difference means.
5.  Saves ONLY the leakage-free model to app/ml/model.pkl.
    The API always loads this file.

Honesty note
-------------
    ~100 rows is a very small training set.  The reported metrics should be
    treated as directional, not definitive.  A 20% test split gives only
    ~20 rows -- a single mis-prediction swings accuracy by ~5%.  These
    limitations are printed alongside the numbers.
"""

import os
import sys
import joblib
import numpy as np

from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
    roc_auc_score,
    make_scorer,
)

# Allow running as `python -m app.ml.train_delay_model` from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.database.session import SessionLocal
from app.ml.delay_prediction import (
    build_training_dataframe,
    print_distributions,
    ALL_FEATURES,
    LEAKAGE_FREE_FEATURES,
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
MODEL_WITH_LEAKAGE_PATH = os.path.join(os.path.dirname(__file__), "model_with_leakage.pkl")

RANDOM_STATE = 42
TEST_SIZE = 0.20


# --------------------------------------------------------------------------- #
# Helpers                                                                       #
# --------------------------------------------------------------------------- #

def build_pipeline() -> Pipeline:
    """Logistic Regression with standard scaling and balanced class weights."""
    return Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            random_state=RANDOM_STATE,
            solver="lbfgs",
        )),
    ])


def print_metrics(
    label: str,
    y_true,
    y_pred,
    y_prob,
    n_train: int,
    n_test: int,
) -> None:
    acc  = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)
    f1   = f1_score(y_true, y_pred, zero_division=0)
    cm   = confusion_matrix(y_true, y_pred)

    print("\n" + "-" * 60)
    print("  " + label)
    print("-" * 60)
    print(f"  Train rows : {n_train}   Test rows : {n_test}")
    print(f"  Accuracy   : {acc:.3f}")
    print(f"  Precision  : {prec:.3f}  (of batches flagged delayed, how many truly were)")
    print(f"  Recall     : {rec:.3f}  (of truly delayed batches, how many were caught)")
    print(f"  F1 Score   : {f1:.3f}")
    print("\n  Confusion matrix (rows=actual, cols=predicted):")
    print("              Pred 0   Pred 1")
    if cm.shape == (2, 2):
        print(f"  Actual 0    {cm[0,0]:>5}    {cm[0,1]:>5}   (true negatives / false positives)")
        print(f"  Actual 1    {cm[1,0]:>5}    {cm[1,1]:>5}   (false negatives / true positives)")
    else:
        print(f"  {cm}")
    print("\n  Classification report:")
    print(classification_report(y_true, y_pred, target_names=["Not delayed", "Delayed"],
                                 zero_division=0))


def print_coefficients(pipeline: Pipeline, feature_names) -> None:
    clf = pipeline.named_steps["clf"]
    scaler = pipeline.named_steps["scaler"]
    coefs = clf.coef_[0]
    stds = scaler.scale_ if hasattr(scaler, "scale_") else np.ones(len(coefs))
    weighted = coefs / stds

    print("\n  Feature coefficients (positive = increases delay risk):")
    for name, coef, w in sorted(
        zip(feature_names, coefs, weighted),
        key=lambda x: -abs(x[2]),
    ):
        direction = "[up] risk" if coef > 0 else "[dn] risk"
        print(f"    {name:<35}  coef={coef:+.3f}  {direction}")


# --------------------------------------------------------------------------- #
# Main training routine                                                          #
# --------------------------------------------------------------------------- #

def main() -> None:
    db = SessionLocal()
    try:
        print("\nLoading data from database...")
        df_features, labels, raw_df = build_training_dataframe(db)
    finally:
        db.close()

    # -- Dataset overview --------------------------------------------------- #
    print_distributions(raw_df)

    n_total = len(labels)
    n_delayed = labels.sum()
    n_notdelayed = n_total - n_delayed

    if n_total < 20:
        print("\n[!] WARNING: Fewer than 20 samples -- metrics will be unreliable.")

    print(f"\n[!] NOTE: {n_total} total samples is a small training set.")
    print(f"   A 20% test split gives only ~{int(n_total * TEST_SIZE)} rows.")
    print("   Treat these metrics as directional, not production-grade.\n")

    # -- Stratified train/test split ---------------------------------------- #
    X_all = df_features[ALL_FEATURES]
    X_noleak = df_features[LEAKAGE_FREE_FEATURES]
    y = labels

    stratify = y if n_delayed >= 2 and n_notdelayed >= 2 else None

    X_all_train, X_all_test, y_train, y_test = train_test_split(
        X_all, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=stratify
    )
    X_noleak_train = X_noleak.loc[X_all_train.index]
    X_noleak_test  = X_noleak.loc[X_all_test.index]

    n_train = len(y_train)
    n_test  = len(y_test)

    # ======================================================================= #
    # ROUND 1 -- With has_delayed_stage (LABEL LEAKAGE)                       #
    # ======================================================================= #
    print("\n" + "#" * 60)
    print("  ROUND 1: MODEL WITH has_delayed_stage  <- LABEL LEAKAGE")
    print("#" * 60)
    print("  has_delayed_stage is set at the same time the batch is marked")
    print("  delayed in the seeded data.  This model is detecting delay")
    print("  after the fact, not predicting it from early signals.")

    pipe_leakage = build_pipeline()
    pipe_leakage.fit(X_all_train, y_train)
    y_pred_leakage = pipe_leakage.predict(X_all_test)
    y_prob_leakage = pipe_leakage.predict_proba(X_all_test)[:, 1]

    print_metrics(
        "WITH has_delayed_stage (leaky)",
        y_test, y_pred_leakage, y_prob_leakage,
        n_train, n_test,
    )
    print_coefficients(pipe_leakage, ALL_FEATURES)
    joblib.dump(pipe_leakage, MODEL_WITH_LEAKAGE_PATH)
    print(f"\n  Saved (reference only, NOT used by API): {MODEL_WITH_LEAKAGE_PATH}")

    acc_leakage = accuracy_score(y_test, y_pred_leakage)
    f1_leakage  = f1_score(y_test, y_pred_leakage, zero_division=0)

    # ======================================================================= #
    # ROUND 2 -- Without has_delayed_stage (LEAKAGE-FREE)                     #
    # ======================================================================= #
    print("\n" + "#" * 60)
    print("  ROUND 2: MODEL WITHOUT has_delayed_stage  <- LEAKAGE-FREE")
    print("#" * 60)
    print("  This model only sees signals knowable before a delay is logged:")
    print("  order size, worker count, stages completed, days open, production line.")
    print("  This is the honest answer to 'can we predict risk early?'")

    pipe_noleak = build_pipeline()
    pipe_noleak.fit(X_noleak_train, y_train)
    y_pred_noleak = pipe_noleak.predict(X_noleak_test)
    y_prob_noleak = pipe_noleak.predict_proba(X_noleak_test)[:, 1]

    print_metrics(
        "WITHOUT has_delayed_stage (leakage-free)",
        y_test, y_pred_noleak, y_prob_noleak,
        n_train, n_test,
    )
    print_coefficients(pipe_noleak, LEAKAGE_FREE_FEATURES)

    acc_noleak = accuracy_score(y_test, y_pred_noleak)
    f1_noleak  = f1_score(y_test, y_pred_noleak, zero_division=0)

    # -- Save leakage-free model (the one the API uses) --------------------- #
    joblib.dump(pipe_noleak, MODEL_PATH)
    print(f"\n  [OK] Saved leakage-free model (used by API): {MODEL_PATH}")

    # ======================================================================= #
    # DIAGNOSTIC 1 -- Predicted probabilities for all 12 delayed batches      #
    # ======================================================================= #
    print("\n" + "#" * 60)
    print("  DIAGNOSTIC 1: RAW PROBABILITIES -- DELAYED vs NOT DELAYED")
    print("  (leakage-free model, scored on ALL 105 rows)")
    print("#" * 60)
    print("""
  Rationale: The 80/20 test split had only 2 delayed batches -- too few
  to draw conclusions from 0 recall.  Scoring all 105 rows with the
  trained model lets us see whether delayed batches tend to cluster at
  higher probabilities even if they don't cross the 0.5 decision boundary.
  This is in-sample (training data included), so treat it as a signal
  check, not a performance estimate.
""")
    # Score on the full dataset (in-sample -- for signal inspection only)
    pipe_full = build_pipeline()
    pipe_full.fit(X_noleak, y)  # retrain on all data for full-dataset scoring
    all_probs = pipe_full.predict_proba(X_noleak)[:, 1]

    delayed_mask    = (y == 1).values
    notdelayed_mask = (y == 0).values
    delayed_probs    = all_probs[delayed_mask]
    notdelayed_probs = all_probs[notdelayed_mask]

    print(f"  Delayed batches (n={delayed_probs.size}):")
    print(f"  {'idx':>4}  {'prob':>7}  note")
    for i, prob in enumerate(sorted(delayed_probs, reverse=True)):
        flag = "  <- above 0.35" if prob >= 0.35 else (
               "  <- above 0.20" if prob >= 0.20 else "")
        print(f"  {i+1:>4}  {prob:.4f}{flag}")

    print(f"\n  Delayed     :  mean={delayed_probs.mean():.4f}  "
          f"median={np.median(delayed_probs):.4f}  "
          f"min={delayed_probs.min():.4f}  max={delayed_probs.max():.4f}")
    print(f"  Not-delayed :  mean={notdelayed_probs.mean():.4f}  "
          f"median={np.median(notdelayed_probs):.4f}  "
          f"min={notdelayed_probs.min():.4f}  max={notdelayed_probs.max():.4f}")

    mean_gap = delayed_probs.mean() - notdelayed_probs.mean()
    print(f"\n  Mean probability gap (delayed - not-delayed): {mean_gap:+.4f}")
    if mean_gap > 0.05:
        print("  -> Delayed batches do score higher on average, suggesting weak"
              " but non-zero signal in the early features.")
    elif mean_gap > 0.01:
        print("  -> Tiny gap -- the early features provide very little signal"
              " beyond what random chance would give.")
    else:
        print("  -> Essentially no gap -- the leakage-free features are not"
              " distinguishing delayed from non-delayed batches at all.")

    # ======================================================================= #
    # DIAGNOSTIC 2 -- 5-fold stratified cross-validation                      #
    # ======================================================================= #
    print("\n" + "#" * 60)
    print("  DIAGNOSTIC 2: 5-FOLD STRATIFIED CROSS-VALIDATION")
    print("  (leakage-free model, all 105 rows, out-of-fold predictions)")
    print("#" * 60)
    print("""
  Rationale: One 80/20 split with 2 delayed test instances is not
  enough to trust any metric.  5-fold CV uses all 105 rows while
  keeping each fold's predictions out-of-sample.  With stratification,
  each fold gets ~2-3 delayed instances.  Mean metrics across 5 folds
  are more stable than any single split, though still noisy at this N.
""")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    scoring = {
        "accuracy":  "accuracy",
        "f1":        make_scorer(f1_score, zero_division=0),
        "roc_auc":   "roc_auc",
        "recall":    make_scorer(recall_score, zero_division=0),
        "precision": make_scorer(precision_score, zero_division=0),
    }
    cv_results = cross_validate(
        build_pipeline(),
        X_noleak, y,
        cv=cv,
        scoring=scoring,
        return_train_score=False,
    )

    print(f"  {'Metric':<12}  {'Fold 1':>7}  {'Fold 2':>7}  "
          f"{'Fold 3':>7}  {'Fold 4':>7}  {'Fold 5':>7}  {'Mean':>7}  {'Std':>6}")
    print(f"  {'-'*12}  {'-'*7}  {'-'*7}  {'-'*7}  {'-'*7}  {'-'*7}  {'-'*7}  {'-'*6}")
    for name, key in [
        ("Accuracy",  "test_accuracy"),
        ("F1",        "test_f1"),
        ("Recall",    "test_recall"),
        ("Precision", "test_precision"),
        ("ROC-AUC",   "test_roc_auc"),
    ]:
        vals = cv_results[key]
        fold_strs = "  ".join(f"{v:>7.3f}" for v in vals)
        print(f"  {name:<12}  {fold_strs}  {vals.mean():>7.3f}  {vals.std():>6.3f}")

    mean_auc    = cv_results["test_roc_auc"].mean()
    mean_f1     = cv_results["test_f1"].mean()
    mean_recall = cv_results["test_recall"].mean()

    print()
    if mean_auc >= 0.65 and mean_recall > 0.0:
        print("  -> CV AUC > 0.65 with non-zero recall: some real predictive signal"
              " exists in the early features, though weak.")
    elif mean_auc >= 0.55:
        print("  -> CV AUC 0.55-0.65: marginal signal at best.  The model is"
              " slightly better than random but not meaningfully reliable.")
    else:
        print("  -> CV AUC <= 0.55: essentially no predictive signal."
              " The leakage-free features cannot distinguish delayed batches"
              " from non-delayed ones in this seeded dataset.")
    print()
    print("  NOTE: days_since_created = 1.0 for every batch (seeded with")
    print("  created_at = now).  This feature is effectively dead and adds")
    print("  no signal -- it would only become useful with real historical data.")

    # ======================================================================= #
    # COMPARISON SUMMARY                                                        #
    # ======================================================================= #
    acc_drop = acc_leakage - acc_noleak
    f1_drop  = f1_leakage  - f1_noleak

    print("\n" + "=" * 60)
    print("  COMPARISON SUMMARY")
    print("=" * 60)
    print(f"  {'Metric':<20}  {'With leakage':>15}  {'Without leakage':>16}")
    print(f"  {'-'*20}  {'-'*15}  {'-'*16}")
    print(f"  {'Accuracy':<20}  {acc_leakage:>15.3f}  {acc_noleak:>16.3f}")
    print(f"  {'F1 (delayed)':<20}  {f1_leakage:>15.3f}  {f1_noleak:>16.3f}")
    print(f"\n  Accuracy drop when removing has_delayed_stage: {acc_drop:+.3f}")
    print(f"  F1 drop when removing has_delayed_stage:        {f1_drop:+.3f}")

    if acc_drop > 0.10 or f1_drop > 0.15:
        print("""
  [!] DIAGNOSIS: has_delayed_stage is label leakage.
      The large performance drop confirms the model was mostly re-reading
      the delay status from that feature rather than predicting it.
      The leakage-free model is the honest predictor.  Its lower metrics
      reflect the genuine difficulty of predicting delay from early signals
      on a small seeded dataset -- not a bug.
""")
    elif acc_drop <= 0.05 and f1_drop <= 0.05:
        print("""
  [OK] has_delayed_stage had minimal impact -- the model's predictive
       power comes from the other early-signal features.
       (This would be the best-case outcome for real-world usefulness.)
""")
    else:
        print("""
  [~] Moderate impact from has_delayed_stage.  Some predictive signal
      exists in the early features, but the leakage feature contributed
      meaningfully.  The leakage-free model is still the honest choice.
""")

    print(f"  API model: {MODEL_PATH}  (leakage-free, 5 features)")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
