from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
import secrets
import hmac
import hashlib
import base64
import json
import sqlite3
from dotenv import load_dotenv
import odoo_client
print("CURRENT DIR:", os.getcwd())
# Session хадгалах (token -> хэрэглэгчийн мэдээлэл)
sessions = {}

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-me")

app = FastAPI(title="Meal Order API")
executor = ThreadPoolExecutor(max_workers=10)

# SQLite DB for favorites
def init_db():
    conn = sqlite3.connect('favorites.db')
    conn.execute('''CREATE TABLE IF NOT EXISTS favorite_employees (
        username TEXT,
        employee_id INTEGER,
        UNIQUE(username, employee_id)
    )''')
    conn.commit()
    conn.close()

def save_favorite_employee(username, employee_id):
    conn = sqlite3.connect('favorites.db')
    conn.execute('INSERT OR IGNORE INTO favorite_employees (username, employee_id) VALUES (?, ?)', (username, employee_id))
    conn.commit()
    conn.close()

def remove_favorite_employee(username, employee_id):
    conn = sqlite3.connect('favorites.db')
    conn.execute('DELETE FROM favorite_employees WHERE username = ? AND employee_id = ?', (username, employee_id))
    conn.commit()
    conn.close()

def get_favorite_employees(username):
    conn = sqlite3.connect('favorites.db')
    cursor = conn.cursor()
    cursor.execute('SELECT employee_id FROM favorite_employees WHERE username = ?', (username,))
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]

# Initialize DB on startup
init_db()

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

def sign_payload(payload: str) -> str:
    return hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()

def encode_token(data: dict) -> str:
    payload = json.dumps(data, separators=(",", ":"), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    signature = sign_payload(payload_b64)
    return f"{payload_b64}.{signature}"

def decode_token(token: str) -> Optional[dict]:
    if not token or "." not in token:
        return None
    payload_b64, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(sign_payload(payload_b64), signature):
        return None
    try:
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode(padded.encode()).decode()
        return json.loads(payload_json)
    except Exception:
        return None

def get_session(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    session = sessions.get(token)
    if session:
        return session
    return decode_token(token)

@app.get("/")
def root():
    return {"message": "Meal Order API ажиллаж байна"}

@app.post("/login")
async def login(data: LoginRequest):
    result = await run(odoo_client.authenticate_user, data.username, data.password)
    if result:
        auth_data = {
            "uid": result["uid"],
            "password": data.password,
            "role": result["role"],
            "name": result["name"],
            "dept_id": result.get("dept_id"),
            "dept_name": result.get("dept_name"),
            "location": result.get("location")
        }
        token = encode_token(auth_data)
        sessions[token] = auth_data
        return {
            "success": True,
            "role": result["role"],
            "name": result["name"],
            "token": token,
            "dept_id": result.get("dept_id"),
            "dept_name": result.get("dept_name"),
            "location": result.get("location")
        }
    return {"success": False}

@app.get("/me")
async def me(authorization: Optional[str] = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else None
    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {
        "role": session["role"],
        "name": session["name"],
        "dept_id": session.get("dept_id"),
        "dept_name": session.get("dept_name"),
        "location": session.get("location")
    }

@app.get("/my-employees")
async def get_my_employees(authorization: Optional[str] = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else None
    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = session["name"]
    favorites = get_favorite_employees(username)
    return {"favorites": favorites}

@app.post("/my-employees/save")
async def save_my_employee(data: dict, authorization: Optional[str] = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else None
    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = session["name"]
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    save_favorite_employee(username, employee_id)
    return {"success": True}

@app.delete("/my-employees/remove")
async def remove_my_employee(data: dict, authorization: Optional[str] = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else None
    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = session["name"]
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    remove_favorite_employee(username, employee_id)
    return {"success": True}

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


class OrderRequest(BaseModel):
    employee_ids: List[int]

@app.post("/create-order")
async def create_order(date: str, meal_type: str, order: OrderRequest, authorization: Optional[str] = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else None
    session = get_session(token)
    employee_ids = order.employee_ids

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
