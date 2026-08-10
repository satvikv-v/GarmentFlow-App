"""
Pydantic schemas for the Dashboard API.

DashboardLowStockItem  -- minimal inventory item info for the low-stock list
DashboardSummary       -- full response shape for GET /dashboard/summary
"""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class DashboardLowStockItem(BaseModel):
    """Minimal projection for each low-stock inventory item."""

    id: int
    name: str
    current_stock: float
    minimum_stock: float

    model_config = {"from_attributes": True}


class DashboardSummary(BaseModel):
    """
    Aggregated factory snapshot returned by GET /dashboard/summary.

    All counts and sums are computed with a single SQL aggregate pass each —
    no Python-side loops over ORM rows.
    """

    # ---- Orders -------------------------------------------------------
    active_orders_count: int = Field(
        description="Orders not in delivered or cancelled status."
    )
    orders_near_deadline: int = Field(
        description=(
            "Active orders whose delivery_deadline falls within the next 3 days."
        )
    )
    delayed_orders_count: int = Field(
        description=(
            "Orders whose linked batch has status=delayed, "
            "OR that have at least one production stage with status=delayed."
        )
    )
    pending_dispatch_count: int = Field(
        description="Orders with status=ready_for_dispatch."
    )

    # ---- Production ---------------------------------------------------
    todays_production: int = Field(
        description=(
            "Sum of quantity_completed across all production_stages "
            "whose completion_time falls today (UTC date)."
        )
    )
    weekly_production: int = Field(
        description="Sum of quantity_completed for stages completed in the last 7 days."
    )
    monthly_production: int = Field(
        description="Sum of quantity_completed for stages completed in the last 30 days."
    )

    # ---- Quality indicators ------------------------------------------
    factory_efficiency: float = Field(
        description=(
            "% of production_stages completed in the last 30 days whose status "
            "is NOT delayed (0.0 – 100.0).  100.0 when no stages exist."
        )
    )
    inventory_health: float = Field(
        description=(
            "% of inventory items whose current_stock > minimum_stock "
            "(0.0 – 100.0).  100.0 when no items exist."
        )
    )

    # ---- Inventory ----------------------------------------------------
    low_stock_materials: List[DashboardLowStockItem] = Field(
        description=(
            "Full list of inventory items where current_stock <= minimum_stock. "
            "Identical filter to GET /inventory/items?low_stock_only=true."
        )
    )
