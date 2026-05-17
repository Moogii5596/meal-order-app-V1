"""
Central configuration — all env vars live here.
Import from this module; never call os.getenv() elsewhere.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")

# ── CORS ──────────────────────────────────────────────────────────────────────
# Comma-separated origins, e.g. "http://localhost:3000,https://myapp.com"
# Defaults to all origins (*) for local development only.
CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH: str = os.getenv("DB_PATH", "favorites.db")

# ── Odoo ──────────────────────────────────────────────────────────────────────
ODOO_URL: str = os.getenv("ODOO_URL", "")
ODOO_DB: str = os.getenv("ODOO_DB", "")
ODOO_USERNAME: str = os.getenv("ODOO_USERNAME", "")
ODOO_PASSWORD: str = os.getenv("ODOO_PASSWORD", "")
