from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
import secrets
from dotenv import load_dotenv
import odoo_client

# Session хадгалах (token -> хэрэглэгчийн мэдээлэл)
sessions = {}

load_dotenv()

app = FastAPI(title="Meal Order API")
executor = ThreadPoolExecutor(max_workers=10)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

def run(fn, *args):
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(executor, fn, *args)

@app.get("/")
def root():
    return {"message": "Meal Order API ажиллаж байна"}

@app.post("/login")
async def login(data: LoginRequest):
    result = await run(odoo_client.authenticate_user, data.username, data.password)
    if result:
        token = secrets.token_hex(32)
        sessions[token] = {
            "uid": result["uid"],
            "password": data.password,
            "role": result["role"],
            "name": result["name"]
        }
        return {
            "success": True,
            "role": result["role"],
            "name": result["name"],
            "token": token,
            "dept_id": result.get("dept_id"),
            "dept_name": result.get("dept_name")
        }
    return {"success": False}

@app.get("/departments")
async def list_departments():
    return await run(odoo_client.get_departments)

@app.get("/employees")
async def list_employees(dept_id: int, date: str, meal_type: str):
    employees = await run(odoo_client.get_employees_by_department, dept_id, date, meal_type)
    return {"employees": employees}

@app.get("/employees/search")
async def search_employees(q: str):
    return await run(odoo_client.search_employees_global, q)

@app.get("/employees/rental")
async def get_rental_employees(q: str = ''):
    return await run(odoo_client.get_rental_employees, q)


@app.post("/create-order")
async def create_order(date: str, meal_type: str, employee_ids: List[int], authorization: Optional[str] = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else None
    session = sessions.get(token) if token else None

    if session:
        order_id = await run(odoo_client.create_meal_order_as_user, date, meal_type, employee_ids, session["uid"], session["password"])
    else:
        order_id = await run(odoo_client.create_meal_order, date, meal_type, employee_ids)

    return {"status": "success", "order_id": order_id}

@app.get("/orders")
async def list_orders(state: str = None):
    return await run(odoo_client.get_orders, state)

@app.get("/orders/{order_id}")
async def get_order(order_id: int):
    detail = await run(odoo_client.get_order_detail, order_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Not found")
    return detail

@app.post("/orders/{order_id}/approve")
async def approve_order(order_id: int):
    await run(odoo_client.update_order_state, order_id, "done")
    return {"success": True}

@app.post("/orders/{order_id}/confirm")
async def confirm_order(order_id: int):
    await run(odoo_client.update_order_state, order_id, "confirmed")
    return {"success": True}
