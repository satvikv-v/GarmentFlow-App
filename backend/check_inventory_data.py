"""
Step 1 data reality check for inventory forecasting.

Queries InventoryTransaction and reports:
- Total issue transactions per item
- Date range of transactions
- Whether per-item history is sufficient for time-series forecasting
- Open/in-progress batch counts (for heuristic approach)
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from collections import defaultdict
from sqlalchemy import func

from app.database.session import SessionLocal
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.production import ProductionBatch
from app.models.enums import TransactionType, BatchStatus

db = SessionLocal()
try:
    # ── 1. Total transaction counts by type ─────────────────────────────── #
    print("=" * 65)
    print("  INVENTORY TRANSACTION REALITY CHECK")
    print("=" * 65)

    total = db.query(InventoryTransaction).count()
    by_type = (
        db.query(
            InventoryTransaction.transaction_type,
            func.count(InventoryTransaction.id).label("cnt"),
        )
        .group_by(InventoryTransaction.transaction_type)
        .all()
    )
    print(f"\n  Total InventoryTransactions : {total}")
    for row in by_type:
        print(f"    {row.transaction_type.value:<20}  {row.cnt}")

    # ── 2. Date range ───────────────────────────────────────────────────── #
    date_range = db.query(
        func.min(InventoryTransaction.created_at),
        func.max(InventoryTransaction.created_at),
    ).first()
    print(f"\n  Date range: {date_range[0]}  ->  {date_range[1]}")
    if date_range[0] and date_range[1]:
        span_days = (date_range[1] - date_range[0]).total_seconds() / 86400
        print(f"  Span: {span_days:.1f} days  ({span_days/7:.1f} weeks)")
    else:
        print("  Span: N/A")

    # ── 3. Issue transactions per item ──────────────────────────────────── #
    print("\n  ISSUE TRANSACTIONS PER ITEM:")
    print(f"  {'id':>4}  {'item name':<30}  {'issues':>6}  "
          f"{'total_qty':>10}  {'min_stock':>9}  {'cur_stock':>9}")
    print(f"  {'-'*4}  {'-'*30}  {'-'*6}  {'-'*10}  {'-'*9}  {'-'*9}")

    items = db.query(InventoryItem).order_by(InventoryItem.id).all()
    issue_counts = []
    for item in items:
        issues = [
            t for t in item.transactions
            if t.transaction_type == TransactionType.ISSUE
        ]
        total_issued = sum(float(t.quantity) for t in issues)
        issue_counts.append(len(issues))
        print(f"  {item.id:>4}  {item.name:<30}  {len(issues):>6}  "
              f"{total_issued:>10.1f}  {float(item.minimum_stock):>9.1f}  "
              f"{float(item.current_stock):>9.1f}")

    print(f"\n  Issues per item: "
          f"min={min(issue_counts)}  "
          f"max={max(issue_counts)}  "
          f"mean={sum(issue_counts)/len(issue_counts):.1f}")

    # ── 4. Temporal spread of issues per item ───────────────────────────── #
    print("\n  TEMPORAL SPREAD OF ISSUES (per item with >0 issues):")
    print(f"  {'id':>4}  {'item name':<30}  {'issues':>6}  "
          f"{'span_hours':>11}  {'unique_dates':>12}")
    print(f"  {'-'*4}  {'-'*30}  {'-'*6}  {'-'*11}  {'-'*12}")

    for item in items:
        issues = [
            t for t in item.transactions
            if t.transaction_type == TransactionType.ISSUE
            and t.created_at is not None
        ]
        if not issues:
            continue
        timestamps = [t.created_at for t in issues]
        span = (max(timestamps) - min(timestamps)).total_seconds() / 3600
        unique_dates = len(set(t.created_at.date() for t in issues))
        print(f"  {item.id:>4}  {item.name:<30}  {len(issues):>6}  "
              f"{span:>11.1f}  {unique_dates:>12}")

    # ── 5. Open/in-progress batch count ─────────────────────────────────── #
    open_statuses = [BatchStatus.IN_PROGRESS, BatchStatus.PENDING]
    open_count = (
        db.query(func.count(ProductionBatch.id))
        .filter(ProductionBatch.status.in_(open_statuses))
        .scalar()
    )
    print(f"\n  Currently open/in-progress batches: {open_count}")

    # ── 6. Issue qty per batch (items that have batch_id linkage) ────────── #
    print("\n  ISSUES LINKED TO A BATCH (sample -- first 10 with batch_id):")
    linked = (
        db.query(InventoryTransaction)
        .filter(
            InventoryTransaction.transaction_type == TransactionType.ISSUE,
            InventoryTransaction.batch_id.isnot(None),
        )
        .limit(10)
        .all()
    )
    if linked:
        for t in linked:
            print(f"    item_id={t.inventory_item_id}  batch_id={t.batch_id}  qty={float(t.quantity)}")
    else:
        print("    None -- issue transactions are not linked to batches in seed data")

    # ── 7. Verdict ───────────────────────────────────────────────────────── #
    print("\n" + "=" * 65)
    print("  VERDICT")
    print("=" * 65)
    items_with_issues = sum(1 for c in issue_counts if c > 0)
    avg_issues = sum(issue_counts) / len(issue_counts) if issue_counts else 0

    if avg_issues >= 10 and span_days > 30:
        print("  -> Enough history for simple moving average / linear trend.")
        verdict = "time_series"
    else:
        print(f"  -> {avg_issues:.1f} issue transactions per item average, "
              f"span={span_days:.0f} days.")
        print("  -> Too sparse and too compressed in time for time-series forecasting.")
        print("  -> Honest approach: heuristic based on average issue qty per batch")
        print("     x number of open batches, labeled as 'estimated near-term demand'")
        print("     rather than a false forecast.")
        verdict = "heuristic"
    print(f"\n  Recommended approach: {verdict}")
    print("=" * 65 + "\n")

finally:
    db.close()
