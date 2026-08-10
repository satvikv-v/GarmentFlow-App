"""Debug: inspect features for the batches that flipped in API tests."""
from app.database.session import SessionLocal
from app.models.production import ProductionBatch
from app.models.enums import BatchStatus
from app.ml.delay_prediction import extract_features

db = SessionLocal()
try:
    for bid, label in [(113, "delayed-by-status"), (105, "completed")]:
        b = db.query(ProductionBatch).filter(ProductionBatch.id == bid).first()
        if b is None:
            print(f"Batch {bid} not found")
            continue
        feats = extract_features(b)
        stage_statuses = [s.status.value for s in b.stages]
        print(f"Batch {bid} ({b.batch_number}) [{label}]")
        print(f"  actual DB status : {b.status.value}")
        print(f"  features         : {feats}")
        print(f"  stage statuses   : {stage_statuses}")
        print()

    print("--- FIRST 5 DELAYED BATCHES (features) ---")
    delayed = (
        db.query(ProductionBatch)
        .filter(ProductionBatch.status == BatchStatus.DELAYED)
        .limit(5).all()
    )
    for b in delayed:
        feats = extract_features(b)
        ratio = feats["stages_completed_ratio"]
        workers = feats["assigned_worker_count"]
        qty = feats["order_quantity"]
        line = feats["production_line"]
        print(f"  id={b.id:>4}  ratio={ratio:.2f}  workers={workers}  qty={qty}  line={line}")

    print()
    print("--- FIRST 5 COMPLETED BATCHES (features) ---")
    completed = (
        db.query(ProductionBatch)
        .filter(ProductionBatch.status == BatchStatus.COMPLETED)
        .limit(5).all()
    )
    for b in completed:
        feats = extract_features(b)
        ratio = feats["stages_completed_ratio"]
        workers = feats["assigned_worker_count"]
        qty = feats["order_quantity"]
        line = feats["production_line"]
        has_delay = any(s.status.value == "delayed" for s in b.stages)
        print(f"  id={b.id:>4}  ratio={ratio:.2f}  workers={workers}  qty={qty}  line={line}  had_delay={has_delay}")

finally:
    db.close()
