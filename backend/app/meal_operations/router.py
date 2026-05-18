"""
Meal-operations routes: /orders, /create-order

URL paths are identical to the previous orders/router.py — frontend compatibility is preserved.
Business logic is now delegated to app.meal_operations.service.
"""
from asyncio import get_event_loop
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.meal_operations import service as meal_svc
from app.meal_operations.schemas import BulkOrderRequest, CreateOrderRequest, UpdateOrderLinesRequest

router = APIRouter(tags=["orders"])

_pool = ThreadPoolExecutor(max_workers=10)


async def _run(fn, *args):
    loop = get_event_loop()
    return await loop.run_in_executor(_pool, fn, *args)


# ── List / detail ─────────────────────────────────────────────────────────────

@router.get("/orders")
async def list_orders(
    state: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
):
    limit  = max(1, min(page_size, 200))   # clamp 1–200
    offset = (max(1, page) - 1) * limit
    return await _run(meal_svc.get_orders, state, date_from, date_to, limit, offset)


@router.get("/orders/{order_id}")
async def get_order(order_id: int):
    detail = await _run(meal_svc.get_order_detail, order_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Not found")
    return detail


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/create-order")
async def create_order(
    date: str,
    meal_type: str,
    order: CreateOrderRequest,
    session: Optional[dict] = Depends(get_current_user),
):
    if session:
        order_id = await _run(
            meal_svc.create_meal_order_as_user,
            date, meal_type, order.employee_ids,
            session["uid"], session["password"],
        )
    else:
        order_id = await _run(meal_svc.create_meal_order, date, meal_type, order.employee_ids)
    return {"status": "success", "order_id": order_id}


# ── State transitions ─────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/approve")
async def approve_order(order_id: int):
    await _run(meal_svc.update_order_state, order_id, "done")
    return {"success": True}


@router.post("/orders/{order_id}/confirm")
async def confirm_order(order_id: int):
    await _run(meal_svc.update_order_state, order_id, "confirmed")
    return {"success": True}


# ── Order lines ───────────────────────────────────────────────────────────────

@router.patch("/orders/{order_id}/lines")
async def update_order_lines(
    order_id: int,
    data: UpdateOrderLinesRequest,
    session: dict = Depends(get_current_user),
):
    ok = await _run(meal_svc.update_order_lines, order_id, data.employee_ids)
    if not ok:
        raise HTTPException(status_code=404, detail="Захиалга олдсонгүй")
    return {"success": True}


# ── Bulk actions ──────────────────────────────────────────────────────────────

@router.post("/orders/bulk-approve")
async def bulk_approve_orders(data: BulkOrderRequest):
    await _run(meal_svc.bulk_approve_orders, data.order_ids)
    return {"success": True, "count": len(data.order_ids)}


@router.post("/orders/bulk-cancel")
async def bulk_cancel_orders(data: BulkOrderRequest):
    await _run(meal_svc.bulk_cancel_orders, data.order_ids)
    return {"success": True, "count": len(data.order_ids)}


@router.post("/orders/bulk-delete")
async def bulk_delete_orders(data: BulkOrderRequest):
    await _run(meal_svc.bulk_delete_orders, data.order_ids)
    return {"success": True, "count": len(data.order_ids)}
