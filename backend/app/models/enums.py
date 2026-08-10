"""
Shared enums for GarmentFlow.

Keeping these in one file (rather than scattered per-model) makes it easy to see
every controlled vocabulary in the system at a glance, and avoids circular imports
between model files that reference each other's enums.
"""

import enum

from sqlalchemy import Enum as SAEnum


def pg_enum(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """
    Build a SQLAlchemy Enum column type that stores each member's .value
    (e.g. "owner") rather than SQLAlchemy's default of the member NAME
    (e.g. "OWNER"). Without this, every enum column below would silently
    store the uppercase Python identifier instead of the lowercase value
    the rest of the app (API responses, frontend, JS) actually uses.
    """
    return SAEnum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


class UserRole(str, enum.Enum):
    OWNER = "owner"
    PRODUCTION_MANAGER = "production_manager"
    INVENTORY_MANAGER = "inventory_manager"
    SALES_EXECUTIVE = "sales_executive"


class OrderPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class OrderType(str, enum.Enum):
    SMALL = "small"
    BULK = "bulk"
    REPEAT = "repeat"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PRODUCTION = "in_production"
    QUALITY_CHECK = "quality_check"
    READY_FOR_DISPATCH = "ready_for_dispatch"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class BatchStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    ON_HOLD = "on_hold"


class StageName(str, enum.Enum):
    FABRIC_ALLOCATION = "fabric_allocation"
    CUTTING = "cutting"
    PRINTING = "printing"
    EMBROIDERY = "embroidery"
    STITCHING = "stitching"
    QUALITY_CHECK = "quality_check"
    IRONING = "ironing"
    PACKING = "packing"
    DISPATCH = "dispatch"


# Fixed sequence used to order stages within a batch and to auto-generate
# the next stage when one completes. Embroidery is optional and can be
# skipped per-batch depending on the order.
STAGE_SEQUENCE = [
    StageName.FABRIC_ALLOCATION,
    StageName.CUTTING,
    StageName.PRINTING,
    StageName.EMBROIDERY,
    StageName.STITCHING,
    StageName.QUALITY_CHECK,
    StageName.IRONING,
    StageName.PACKING,
    StageName.DISPATCH,
]


class StageStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    SKIPPED = "skipped"


class InventoryCategory(str, enum.Enum):
    FABRIC = "fabric"
    THREAD = "thread"
    BUTTON = "button"
    ZIPPER = "zipper"
    LABEL = "label"
    PACKAGING = "packaging"
    ACCESSORY = "accessory"


class TransactionType(str, enum.Enum):
    ISSUE = "issue"
    RECEIVE = "receive"
    ADJUSTMENT = "adjustment"


class PurchaseOrderStatus(str, enum.Enum):
    ORDERED = "ordered"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    DELAYED = "delayed"
    CANCELLED = "cancelled"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"
    LEAVE = "leave"


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    RETURNED = "returned"


class DelayRisk(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
