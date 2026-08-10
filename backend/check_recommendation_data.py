"""Audit data for production recommendation engine design."""
from app.database.session import SessionLocal
from app.models.order import Order
from app.models.enums import OrderStatus, OrderPriority, BatchStatus
from app.models.worker import Worker
from app.models.production import ProductionBatch, BatchWorker
from sqlalchemy import func
from datetime import date

db = SessionLocal()
try:
    today = date.today()

    # ── Order status breakdown ──────────────────────────────────────────── #
    status_counts = (
        db.query(Order.status, func.count(Order.id))
        .group_by(Order.status).all()
    )
    print("Order status breakdown:")
    for s, c in status_counts:
        print(f"  {s.value:<25} {c}")

    # ── PENDING orders (unbatched candidates) ────────────────────────────── #
    n_pending = db.query(Order).filter(Order.status == OrderStatus.PENDING).count()
    pending = (
        db.query(Order).filter(Order.status == OrderStatus.PENDING).limit(10).all()
    )
    print(f"\nPENDING orders ({n_pending} total, showing first 10):")
    header = f"  {'id':>4}  {'priority':<8}  {'qty':>5}  {'days':>6}  {'fabric':<22}  {'batches':>7}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for o in pending:
        days = (o.delivery_deadline - today).days
        nbatches = len(o.batches)
        print(f"  {o.id:>4}  {o.priority.value:<8}  {o.quantity:>5}  {days:>6}  {o.fabric:<22}  {nbatches:>7}")

    # ── Active workers by department ─────────────────────────────────────── #
    dept_counts = (
        db.query(Worker.department, func.count(Worker.id))
        .filter(Worker.is_active == True)
        .group_by(Worker.department)
        .order_by(Worker.department)
        .all()
    )
    print("\nActive workers by department:")
    for dept, cnt in dept_counts:
        print(f"  {dept:<25} {cnt}")

    total_active = db.query(func.count(Worker.id)).filter(Worker.is_active == True).scalar()
    print(f"  Total active: {total_active}")

    # Workers currently assigned to IN_PROGRESS batches
    busy_ids = (
        db.query(BatchWorker.worker_id)
        .join(ProductionBatch, BatchWorker.batch_id == ProductionBatch.id)
        .filter(ProductionBatch.status == BatchStatus.IN_PROGRESS)
        .distinct()
        .all()
    )
    busy_count = len(busy_ids)
    print(f"\n  Workers assigned to IN_PROGRESS batches: {busy_count}")
    print(f"  Free workers (not in active batch):      {total_active - busy_count}")
    print(f"  NOTE: Workers can be assigned to multiple batches in the schema")

    # ── Do PENDING orders have batches? ─────────────────────────────────── #
    pending_with_batches = [o for o in pending if len(o.batches) > 0]
    print(f"\n  PENDING orders with existing batches: {len(pending_with_batches)}/{len(pending)}")

    # ── Fabric field values on pending orders ───────────────────────────── #
    fabric_vals = set(o.fabric for o in pending)
    print(f"\n  Distinct fabric values on pending orders: {sorted(fabric_vals)}")

    # ── Priority distribution of pending orders ──────────────────────────── #
    print("\n  Priority breakdown of PENDING orders:")
    pri_counts = (
        db.query(Order.priority, func.count(Order.id))
        .filter(Order.status == OrderStatus.PENDING)
        .group_by(Order.priority).all()
    )
    for pri, cnt in pri_counts:
        print(f"    {pri.value:<10} {cnt}")

    # ── Deadline distribution ─────────────────────────────────────────────── #
    print("\n  Deadline distribution of PENDING orders (days from today):")
    urgent_count = sum(1 for o in pending if (o.delivery_deadline - today).days <= 7)
    medium_count = sum(1 for o in pending if 7 < (o.delivery_deadline - today).days <= 30)
    far_count    = sum(1 for o in pending if (o.delivery_deadline - today).days > 30)
    all_pending_full = db.query(Order).filter(Order.status == OrderStatus.PENDING).all()
    print(f"    <= 7 days:  {sum(1 for o in all_pending_full if (o.delivery_deadline-today).days<=7)}")
    print(f"    8-30 days:  {sum(1 for o in all_pending_full if 8<=(o.delivery_deadline-today).days<=30)}")
    print(f"    > 30 days:  {sum(1 for o in all_pending_full if (o.delivery_deadline-today).days>30)}")

finally:
    db.close()
