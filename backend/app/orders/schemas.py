"""
Backward-compatibility shim.

All schemas have moved to app.meal_operations.schemas.
This module re-exports them so any existing import still works.
"""
from app.meal_operations.schemas import (  # noqa: F401
    BulkOrderRequest,
    CreateOrderRequest,
    UpdateOrderLinesRequest,
)
