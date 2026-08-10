"""
Importing every model here ensures they're all registered on Base.metadata
before Alembic's autogenerate (or Base.metadata.create_all) runs — otherwise
tables that are never imported elsewhere would silently be skipped.
"""

from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order
from app.models.worker import Worker
from app.models.attendance import Attendance
from app.models.production import (
    ProductionBatch,
    ProductionStage,
    BatchWorker,
    StageWorker,
)
from app.models.supplier import Supplier
from app.models.inventory import InventoryItem, InventoryTransaction, PurchaseOrder
from app.models.dispatch import Dispatch

__all__ = [
    "User",
    "Customer",
    "Order",
    "Worker",
    "Attendance",
    "ProductionBatch",
    "ProductionStage",
    "BatchWorker",
    "StageWorker",
    "Supplier",
    "InventoryItem",
    "InventoryTransaction",
    "PurchaseOrder",
    "Dispatch",
]
