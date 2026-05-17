"""
Authentication service.

Handles token creation, verification, and the in-memory session store.
"""
import base64
import hashlib
import hmac
import json
from typing import Optional

from app.config import SECRET_KEY

# In-memory session store: token -> user data dict
_sessions: dict[str, dict] = {}


def _sign(payload: str) -> str:
    return hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token(data: dict) -> str:
    """Encode a dict as a signed token string."""
    payload_json = json.dumps(data, separators=(",", ":"), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
    signature = _sign(payload_b64)
    token = f"{payload_b64}.{signature}"
    _sessions[token] = data
    return token


def decode_token(token: str) -> Optional[dict]:
    """Verify and decode a token. Returns None if invalid."""
    if not token or "." not in token:
        return None
    payload_b64, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(payload_b64), signature):
        return None
    try:
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        return json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
    except Exception:
        return None


def get_session(token: Optional[str]) -> Optional[dict]:
    """Return session data for a token, checking in-memory cache first."""
    if not token:
        return None
    return _sessions.get(token) or decode_token(token)


def extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Strip 'Bearer ' prefix from an Authorization header value."""
    if not authorization:
        return None
    return authorization.removeprefix("Bearer ").strip()
