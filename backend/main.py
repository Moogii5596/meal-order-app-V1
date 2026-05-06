from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import odoo_client

app = FastAPI(title="Meal Order API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Meal Order API ажиллаж байна"}

@app.get("/departments")
def list_departments():
    return odoo_client.get_departments()

@app.get("/employees")
def list_employees(dept_id: int, date: str, meal_type: str):
    employees = odoo_client.get_employees_by_department(dept_id, date, meal_type)
    return {"employees": employees}

@app.post("/create-order")
def create_order(date: str, meal_type: str, employee_ids: List[int]):
    order_id = odoo_client.create_meal_order(date, meal_type, employee_ids)
    return {"status": "success", "order_id": order_id}