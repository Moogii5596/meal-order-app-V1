"""Pydantic request schemas for meal order endpoints."""
from typing import List
from pydantic import BaseModel


class CreateOrderRequest(BaseModel):
    employee_ids: List[int]


class UpdateOrderLinesRequest(BaseModel):
    employee_ids: List[int]


class BulkOrderRequest(BaseModel):
    order_ids: List[int]
