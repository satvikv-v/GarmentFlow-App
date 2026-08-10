import os
"""
Seed the GarmentFlow database with realistic factory data.

Run from the backend/ directory:
    python seed.py

Safe to re-run: it wipes and recreates all seeded rows each time (see
`reset_tables` below), so you always get a clean, consistent dataset rather
than duplicates piling up across runs.
"""

import random
from datetime import date, datetime, timedelta, timezone

from faker import Faker

from app.database.session import SessionLocal
from app.core.security import hash_password
from app.models import (
    User,
    Customer,
    Order,
    Worker,
    Attendance,
    ProductionBatch,
    ProductionStage,
    BatchWorker,
    StageWorker,
    Supplier,
    InventoryItem,
    InventoryTransaction,
    PurchaseOrder,
    Dispatch,
)
from app.models.enums import (
    UserRole,
    OrderPriority,
    OrderType,
    OrderStatus,
    BatchStatus,
    StageStatus,
    STAGE_SEQUENCE,
    InventoryCategory,
    TransactionType,
    PurchaseOrderStatus,
    AttendanceStatus,
    DeliveryStatus,
)

fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)

# ---------------------------------------------------------------------------
# Factory-specific reference data (kept manual, not Faker-generated, so the
# dataset actually looks like a garment factory rather than random nouns).
# ---------------------------------------------------------------------------

PRODUCT_CATALOG = [
    # name, fabric, base_cost, sell_price
    ("Round Neck T-Shirt", "Cotton", 120, 280),
    ("Polo Shirt", "Pique Cotton", 180, 420),
    ("Hoodie", "Fleece", 320, 750),
    ("Sweatshirt", "Fleece", 280, 650),
    ("School Uniform Shirt", "Cotton Blend", 150, 340),
    ("School Uniform Trousers", "Terrycot", 190, 420),
    ("Corporate Shirt", "Cotton Poplin", 220, 520),
    ("Cargo Pants", "Cotton Twill", 260, 600),
    ("Denim Jacket", "Denim", 380, 950),
    ("Track Pants", "Polyester Blend", 160, 380),
    ("Kids T-Shirt", "Cotton", 90, 220),
    ("Formal Trousers", "Poly-Viscose", 240, 580),
    ("Blazer", "Wool Blend", 550, 1400),
    ("Rain Jacket", "Polyester (Coated)", 300, 700),
    ("Sports Jersey", "Polyester Mesh", 140, 340),
    ("Apron", "Cotton Canvas", 80, 190),
    ("Scarf", "Cotton Voile", 60, 150),
    ("Cap", "Cotton Twill", 50, 130),
    ("Nightwear Set", "Cotton Jersey", 170, 400),
    ("Denim Jeans", "Denim", 340, 820),
]

COLORS = ["Black", "White", "Navy", "Red", "Grey", "Royal Blue", "Maroon", "Olive"]

SIZES = ["S", "M", "L", "XL", "XXL"]

CUSTOMER_COMPANIES = [
    "TrendWear Pvt Ltd", "Urban Stitch", "Classic Uniforms", "Campus Threads",
    "Metro Apparel Co", "Sunrise Garments", "Elite Corporate Wear",
    "Kidswear Junction", "Active Sports Gear", "Heritage Textiles",
    "Modern Fit Clothing", "Prime Uniform Solutions", "City Threads",
    "Comfort Zone Apparel", "Bright Kids Wear", "Formal Edge",
]

SUPPLIER_DATA = [
    ("Cotton India", "Fabric — cotton, cotton blends"),
    ("ABC Textiles", "Fabric — polyester, poly-viscose"),
    ("Metro Buttons", "Buttons, fasteners"),
    ("ZipWorld", "Zippers"),
    ("Premium Threads Co", "Sewing thread"),
    ("LabelCraft", "Woven and printed labels"),
    ("PackPro Solutions", "Packaging boxes, poly bags"),
    ("Denim House", "Denim fabric"),
    ("Wool & Wear Suppliers", "Wool blend fabric"),
]

INVENTORY_CATALOG = [
    # name, category, unit, min_stock, purchase_cost
    ("Black Cotton Fabric", InventoryCategory.FABRIC, "meters", 200, 180),
    ("White Cotton Fabric", InventoryCategory.FABRIC, "meters", 200, 175),
    ("Navy Cotton Fabric", InventoryCategory.FABRIC, "meters", 150, 185),
    ("Polyester Blend Fabric", InventoryCategory.FABRIC, "meters", 150, 150),
    ("Denim Fabric", InventoryCategory.FABRIC, "meters", 100, 260),
    ("Fleece Fabric", InventoryCategory.FABRIC, "meters", 120, 220),
    ("Sewing Thread (Cone)", InventoryCategory.THREAD, "pieces", 100, 45),
    ("Plastic Buttons", InventoryCategory.BUTTON, "pieces", 5000, 1),
    ("Metal Zippers 7-inch", InventoryCategory.ZIPPER, "pieces", 500, 12),
    ("Metal Zippers 18-inch", InventoryCategory.ZIPPER, "pieces", 300, 22),
    ("Woven Brand Labels", InventoryCategory.LABEL, "pieces", 2000, 2),
    ("Size Labels", InventoryCategory.LABEL, "pieces", 2000, 1),
    ("Packaging Boxes (Medium)", InventoryCategory.PACKAGING, "pieces", 300, 15),
    ("Poly Bags", InventoryCategory.PACKAGING, "pieces", 1000, 3),
    ("Shoulder Pads", InventoryCategory.ACCESSORY, "pieces", 200, 8),
]

WORKER_NAMES_BY_DEPT = {
    "Cutting": 4,
    "Printing": 3,
    "Embroidery": 2,
    "Stitching": 8,
    "Quality Check": 3,
    "Ironing": 2,
    "Packing": 3,
}

DEPARTMENT_TO_STAGE = {
    "Cutting": "cutting",
    "Printing": "printing",
    "Embroidery": "embroidery",
    "Stitching": "stitching",
    "Quality Check": "quality_check",
    "Ironing": "ironing",
    "Packing": "packing",
}

# Curated worker roster — Sheshu is always first and receives the Head Worker skill.
# If total worker slots (sum of WORKER_NAMES_BY_DEPT values) exceed the list length,
# remaining slots fall back to fake.name().
CURATED_WORKER_NAMES = [
    "Sheshu",          # Head Worker — seeded with skill='Head Worker'
    "Ravi Kumar",
    "Manjunath R",
    "Suresh B",
    "Prakash M",
    "Srinivas K",
    "Ramesh Gowda",
    "Venkatesh N",
    "Mohammed Sameer",
    "Abdul Rahman",
    "Mohammed Irfan",
    "Syed Imran",
]

TEST_USERS = [
    ("demo_owner", "demo.owner@example.com", "Demo Owner", UserRole.OWNER),
    ("production_manager", "production@ahinco.com", "Priya Sharma", UserRole.PRODUCTION_MANAGER),
    ("inventory_manager", "inventory@ahinco.com", "Amit Verma", UserRole.INVENTORY_MANAGER),
    ("sales_executive", "sales@ahinco.com", "Neha Kapoor", UserRole.SALES_EXECUTIVE),
]
TEST_PASSWORD = os.getenv("TEST_PASSWORD")


def reset_tables(db):
    """Delete all seeded rows, respecting FK order (children before parents)."""
    for model in [
        StageWorker, BatchWorker, ProductionStage, Dispatch,
        InventoryTransaction, PurchaseOrder, ProductionBatch,
        Order, Attendance, InventoryItem, Worker, Customer, Supplier, User,
    ]:
        db.query(model).delete()
    db.commit()


def seed_users(db):
    users = []
    for username, email, full_name, role in TEST_USERS:
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            hashed_password=hash_password(TEST_PASSWORD),
            role=role,
            is_active=True,
        )
        db.add(user)
        users.append(user)
    db.flush()
    return users


def seed_customers(db, count=60):
    customers = []
    for i in range(count):
        company = (
            CUSTOMER_COMPANIES[i]
            if i < len(CUSTOMER_COMPANIES)
            else f"{fake.company()} {random.choice(['Textiles', 'Apparel', 'Garments', 'Wear'])}"
        )
        customer = Customer(
            name=fake.name(),
            company=company,
            contact_phone=fake.phone_number()[:20],
            contact_email=fake.company_email(),
            address=fake.address().replace("\n", ", "),
        )
        db.add(customer)
        customers.append(customer)
    db.flush()
    return customers


def seed_suppliers(db):
    suppliers = []
    for name, materials in SUPPLIER_DATA:
        supplier = Supplier(
            name=name,
            contact_person=fake.name(),
            contact_phone=fake.phone_number()[:20],
            contact_email=fake.company_email(),
            materials_supplied=materials,
            average_delivery_days=round(random.uniform(3, 15), 1),
            quality_rating=round(random.uniform(2.5, 5.0), 1),
        )
        db.add(supplier)
        suppliers.append(supplier)
    db.flush()
    return suppliers


def seed_inventory(db, suppliers):
    items = []
    for name, category, unit, min_stock, cost in INVENTORY_CATALOG:
        current_stock = min_stock * random.uniform(0.4, 3.0)  # some deliberately low-stock
        item = InventoryItem(
            name=name,
            category=category,
            unit=unit,
            current_stock=round(current_stock, 2),
            minimum_stock=min_stock,
            supplier_id=random.choice(suppliers).id,
            purchase_cost=cost,
            last_purchase_date=fake.date_between(start_date="-60d", end_date="-1d"),
        )
        db.add(item)
        items.append(item)
    db.flush()
    return items


def seed_workers(db):
    workers = []
    name_pool = list(CURATED_WORKER_NAMES)  # consume curated names in order
    slot_index = 0  # global slot counter across all departments

    for dept, count in WORKER_NAMES_BY_DEPT.items():
        for _ in range(count):
            if name_pool:
                name = name_pool.pop(0)
            else:
                name = fake.name()

            # Sheshu is always slot 0 and is the Head Worker.
            if slot_index == 0:
                skill = "Head Worker"
            else:
                skill = f"{dept} specialist"

            worker = Worker(
                name=name,
                department=dept,
                skill=skill,
                is_active=random.random() > 0.05,  # a few inactive/left workers
            )
            db.add(worker)
            workers.append(worker)
            slot_index += 1

    db.flush()
    return workers


def seed_attendance(db, workers, weeks=6):
    """Attendance for the last N weeks, weekdays only."""
    today = date.today()
    start = today - timedelta(weeks=weeks)
    day = start
    while day <= today:
        if day.weekday() < 6:  # Mon-Sat working days
            for worker in workers:
                if not worker.is_active:
                    continue
                roll = random.random()
                if roll < 0.88:
                    status = AttendanceStatus.PRESENT
                    overtime = round(random.choice([0, 0, 0, 1, 1.5, 2]), 2)
                    output = random.randint(30, 90)
                elif roll < 0.95:
                    status = AttendanceStatus.HALF_DAY
                    overtime = 0
                    output = random.randint(10, 40)
                elif roll < 0.98:
                    status = AttendanceStatus.ABSENT
                    overtime = 0
                    output = None
                else:
                    status = AttendanceStatus.LEAVE
                    overtime = 0
                    output = None
                db.add(Attendance(
                    worker_id=worker.id,
                    date=day,
                    status=status,
                    overtime_hours=overtime,
                    output_quantity=output,
                ))
        day += timedelta(days=1)
    db.flush()


def seed_orders(db, customers, sales_user, count=120):
    orders = []
    for i in range(count):
        product_name, fabric, base_cost, sell_price = random.choice(PRODUCT_CATALOG)
        color = random.choice(COLORS)
        quantity = random.choice([50, 100, 150, 200, 300, 500, 800])

        sizes = random.sample(SIZES, k=random.randint(3, 5))
        remaining = quantity
        breakdown = {}
        for idx, size in enumerate(sizes):
            if idx == len(sizes) - 1:
                breakdown[size] = remaining
            else:
                portion = int(quantity * random.uniform(0.1, 0.35))
                portion = min(portion, remaining - (len(sizes) - idx - 1))
                breakdown[size] = max(portion, 1)
                remaining -= breakdown[size]

        created_days_ago = random.randint(5, 120)
        order_type = (
            OrderType.BULK if quantity >= 300
            else OrderType.REPEAT if random.random() < 0.2
            else OrderType.SMALL
        )
        # Weighted status distribution so the dataset has a realistic mix
        # (mostly resolved orders, a healthy pipeline, a few problem cases).
        status = random.choices(
            list(OrderStatus),
            weights=[10, 8, 20, 10, 10, 15, 20, 3],  # matches OrderStatus enum order
        )[0]

        order = Order(
            order_number=f"ORD-{2000 + i}",
            customer_id=random.choice(customers).id,
            product=product_name,
            color=color,
            fabric=fabric,
            size_breakdown=breakdown,
            quantity=quantity,
            delivery_deadline=date.today() + timedelta(days=random.randint(-10, 45)),
            priority=random.choices(
                list(OrderPriority), weights=[30, 40, 20, 10]
            )[0],
            order_type=order_type,
            status=status,
            created_by_id=sales_user.id,
        )
        db.add(order)
        orders.append(order)
    db.flush()
    return orders


def seed_production(db, orders, workers):
    """Create a batch (+ full stage pipeline) for most orders, skipping
    embroidery on ~60% of batches since it's an optional stage per the spec."""
    workers_by_dept = {}
    for w in workers:
        workers_by_dept.setdefault(w.department, []).append(w)

    batches = []
    batch_num = 5000
    for order in orders:
        if order.status == OrderStatus.PENDING:
            continue  # no batch planned yet — realistic "not started" case

        skip_embroidery = random.random() < 0.6
        include_stages = [
            s for s in STAGE_SEQUENCE
            if not (skip_embroidery and s.value == "embroidery")
        ]

        if order.status in (OrderStatus.DISPATCHED, OrderStatus.DELIVERED):
            batch_status = BatchStatus.COMPLETED
        elif order.status == OrderStatus.CANCELLED:
            batch_status = BatchStatus.ON_HOLD
        elif random.random() < 0.12:
            batch_status = BatchStatus.DELAYED
        else:
            batch_status = BatchStatus.IN_PROGRESS

        batch_num += 1
        batch = ProductionBatch(
            batch_number=f"BATCH-{batch_num}",
            order_id=order.id,
            production_line=random.choice(["Line A", "Line B", "Line C"]),
            planned_quantity=order.quantity,
            expected_completion_date=order.delivery_deadline,
            status=batch_status,
        )
        db.add(batch)
        db.flush()
        batches.append(batch)

        # Assign 4-10 workers to the batch overall.
        assigned = random.sample(workers, k=min(random.randint(4, 10), len(workers)))
        for w in assigned:
            db.add(BatchWorker(batch_id=batch.id, worker_id=w.id))

        # How far through the pipeline this batch has progressed.
        if batch_status == BatchStatus.COMPLETED:
            progressed_through = len(include_stages)
        elif batch_status == BatchStatus.DELAYED:
            progressed_through = random.randint(1, len(include_stages) - 2)
        else:
            progressed_through = random.randint(1, len(include_stages) - 1)

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for idx, stage_name in enumerate(include_stages):
            seq = STAGE_SEQUENCE.index(stage_name) + 1
            dept = next(
                (d for d, s in DEPARTMENT_TO_STAGE.items() if s == stage_name.value),
                None,
            )
            stage_workers_pool = workers_by_dept.get(dept, workers) if dept else workers

            if idx < progressed_through - 1:
                stage_status = StageStatus.COMPLETED
                start = now - timedelta(days=(progressed_through - idx) * 2)
                completion = start + timedelta(hours=random.randint(4, 20))
                qty_done = order.quantity
                delay_reason = None
            elif idx == progressed_through - 1 and batch_status != BatchStatus.COMPLETED:
                stage_status = (
                    StageStatus.DELAYED if batch_status == BatchStatus.DELAYED
                    else StageStatus.IN_PROGRESS
                )
                start = now - timedelta(hours=random.randint(2, 30))
                completion = None
                qty_done = int(order.quantity * random.uniform(0.2, 0.8))
                delay_reason = (
                    random.choice([
                        "Worker shortage", "Machine breakdown",
                        "Awaiting material", "Quality rework needed",
                    ]) if stage_status == StageStatus.DELAYED else None
                )
            elif idx < progressed_through:
                stage_status = StageStatus.COMPLETED
                start = now - timedelta(days=2)
                completion = now - timedelta(hours=random.randint(1, 10))
                qty_done = order.quantity
                delay_reason = None
            else:
                stage_status = StageStatus.PENDING
                start = None
                completion = None
                qty_done = 0
                delay_reason = None

            stage = ProductionStage(
                batch_id=batch.id,
                stage_name=stage_name,
                sequence_order=seq,
                status=stage_status,
                start_time=start,
                completion_time=completion,
                quantity_completed=qty_done,
                delay_reason=delay_reason,
                notes=None,
            )
            db.add(stage)
            db.flush()

            if stage_status in (StageStatus.COMPLETED, StageStatus.IN_PROGRESS, StageStatus.DELAYED):
                for w in random.sample(
                    stage_workers_pool, k=min(2, len(stage_workers_pool))
                ):
                    db.add(StageWorker(stage_id=stage.id, worker_id=w.id))

    db.flush()
    return batches


def seed_purchase_orders_and_transactions(db, inventory_items, batches, inventory_user):
    # Receive transactions — how the current stock got there.
    for item in inventory_items:
        db.add(InventoryTransaction(
            inventory_item_id=item.id,
            transaction_type=TransactionType.RECEIVE,
            quantity=item.current_stock,
            reference=f"Opening stock — {item.last_purchase_date}",
            created_by_id=inventory_user.id,
        ))

    # A handful of purchase orders in various states.
    for _ in range(30):
        item = random.choice(inventory_items)
        supplier_id = item.supplier_id
        order_date = fake.date_between(start_date="-45d", end_date="-1d")
        status = random.choices(
            list(PurchaseOrderStatus), weights=[20, 20, 40, 15, 5]
        )[0]
        expected = order_date + timedelta(days=random.randint(3, 15))
        actual = (
            expected + timedelta(days=random.randint(-1, 5))
            if status in (PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.DELAYED)
            else None
        )
        db.add(PurchaseOrder(
            supplier_id=supplier_id,
            inventory_item_id=item.id,
            quantity=round(random.uniform(50, 500), 2),
            unit_cost=item.purchase_cost,
            order_date=order_date,
            expected_delivery_date=expected,
            actual_delivery_date=actual,
            status=status,
        ))

    # Issue transactions — material consumed by batches that have moved
    # past fabric allocation.
    fabric_items = [i for i in inventory_items if i.category == InventoryCategory.FABRIC]
    for batch in batches:
        if not fabric_items:
            break
        item = random.choice(fabric_items)
        db.add(InventoryTransaction(
            inventory_item_id=item.id,
            transaction_type=TransactionType.ISSUE,
            quantity=round(batch.planned_quantity * random.uniform(1.4, 1.8), 2),
            batch_id=batch.id,
            reference=f"Issued for {batch.batch_number}",
            created_by_id=inventory_user.id,
        ))

    db.flush()


def seed_dispatch(db, orders, batches):
    batches_by_order = {b.order_id: b for b in batches}
    for order in orders:
        if order.status not in (OrderStatus.DISPATCHED, OrderStatus.DELIVERED):
            continue
        batch = batches_by_order.get(order.id)
        dispatch_date = order.delivery_deadline - timedelta(days=random.randint(0, 3))
        delivery_status = (
            DeliveryStatus.DELIVERED if order.status == OrderStatus.DELIVERED
            else random.choice([DeliveryStatus.SHIPPED, DeliveryStatus.IN_TRANSIT])
        )
        db.add(Dispatch(
            order_id=order.id,
            batch_id=batch.id if batch else None,
            invoice_number=f"INV-{order.order_number.split('-')[1]}",
            courier=random.choice(["BlueDart", "Delhivery", "DTDC", "Own Fleet"]),
            dispatch_date=dispatch_date,
            tracking_number=fake.bothify(text="TRK########"),
            delivery_status=delivery_status,
        ))
    db.flush()


def main():
    db = SessionLocal()
    try:
        print("Wiping existing seeded data...")
        reset_tables(db)

        print("Seeding users...")
        users = seed_users(db)
        sales_user = next(u for u in users if u.role == UserRole.SALES_EXECUTIVE)
        inventory_user = next(u for u in users if u.role == UserRole.INVENTORY_MANAGER)

        print("Seeding customers...")
        customers = seed_customers(db)

        print("Seeding suppliers...")
        suppliers = seed_suppliers(db)

        print("Seeding inventory...")
        inventory_items = seed_inventory(db, suppliers)

        print("Seeding workers...")
        workers = seed_workers(db)

        print("Seeding attendance (6 weeks)...")
        seed_attendance(db, workers)

        print("Seeding orders...")
        orders = seed_orders(db, customers, sales_user)

        print("Seeding production batches + stages...")
        batches = seed_production(db, orders, workers)

        print("Seeding purchase orders + inventory transactions...")
        seed_purchase_orders_and_transactions(db, inventory_items, batches, inventory_user)

        print("Seeding dispatch records...")
        seed_dispatch(db, orders, batches)

        db.commit()

        print("\nDone. Seeded:")
        print(f"  Users: {len(users)}  (all passwords: {TEST_PASSWORD})")
        print(f"  Customers: {len(customers)}")
        print(f"  Suppliers: {len(suppliers)}")
        print(f"  Inventory items: {len(inventory_items)}")
        print(f"  Workers: {len(workers)}")
        print(f"  Orders: {len(orders)}")
        print(f"  Production batches: {len(batches)}")
        print("\nTest logins:")
        for username, email, full_name, role in TEST_USERS:
            print(f"  {role.value:<20} username={username:<20} password={TEST_PASSWORD}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
