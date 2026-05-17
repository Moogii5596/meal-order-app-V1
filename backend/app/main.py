"""
Application factory.

Wires together middleware, DB initialisation, and domain routers.
Business logic lives in the domain modules:

  app/
    auth/            — login, token validation
    employees/       — departments, employee search, favorites
    meal_operations/ — order CRUD, state transitions, bulk ops
    camp/            — camp-manager admin views
    reconciliation/  — swipe-mismatch analysis (service only, no router yet)
    reporting/       — analytics aggregations (service only, no router yet)
    odoo/            — XML-RPC transport layer (no domain logic)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import init_db
from app.auth.router         import router as auth_router
from app.employees.router    import router as employees_router
from app.meal_operations.router import router as meal_ops_router
from app.camp.router         import router as camp_router
from app.debug_router        import router as debug_router  # TEMP — remove after investigation

app = FastAPI(title="Meal Order API")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database ──────────────────────────────────────────────────────────────────
init_db()

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(employees_router)
app.include_router(meal_ops_router)
app.include_router(camp_router)
app.include_router(debug_router)  # TEMP — remove after investigation


@app.get("/")
def root():
    return {"message": "Meal Order API ажиллаж байна"}
