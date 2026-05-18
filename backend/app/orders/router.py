"""
Backward-compatibility shim.

The meal-operations router has moved to app.meal_operations.router.
app.main now imports from there directly; this module re-exports the router
object so any other import of app.orders.router still resolves correctly.
"""
from app.meal_operations.router import router  # noqa: F401
