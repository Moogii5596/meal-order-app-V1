"""
Odoo XML-RPC executor.

`OdooSession` is the single abstraction for making Odoo calls.  It bundles
(db, uid, password) so callers never repeat those three arguments, and it
exposes semantic helpers (search_read, read, write, …) instead of raw
execute_kw strings.

Thread-safety
─────────────
Python's xmlrpc.client.Transport is *not* thread-safe, so a fresh
ServerProxy is created for every call via `_models()`.  Two threads sharing
the same OdooSession instance are therefore safe — each call gets its own
transport.

Parallel execution
──────────────────
`OdooSession.parallel(*fns)` runs independent zero-arg callables concurrently
in a thread pool.  Because each call creates its own proxy, no lock or queue
is needed.

    groups, page = s.parallel(
        lambda: s.read_group("meal.order", domain, ["state"], ["state"]),
        lambda: s.search_read("meal.order", domain, FIELDS, order="date desc"),
    )

Preparing for a sync architecture
──────────────────────────────────
All *read* paths flow through OdooSession methods (search_read, read,
read_group).  When a local-sync layer is added, swap `admin_session()` for a
`SyncedSession` that serves reads from the local DB while still routing
writes (write, create, unlink, call) to Odoo.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from app.config import ODOO_DB, ODOO_PASSWORD
from app.odoo.client import _admin_uid, _models


class OdooSession:
    """
    A reusable session bound to one (db, uid, password) triple.

    Create instances via `admin_session()` or `user_session()` — not directly.
    One session object may be reused across multiple sequential or parallel calls.
    """

    __slots__ = ("db", "uid", "password")

    def __init__(self, db: str, uid: int, password: str) -> None:
        self.db       = db
        self.uid      = uid
        self.password = password

    # ── Core ─────────────────────────────────────────────────────────────────

    def execute(
        self,
        model: str,
        method: str,
        args: list | None = None,
        kwargs: dict | None = None,
    ) -> Any:
        """
        Direct wrapper around execute_kw.  Creates a fresh proxy per call.

        `args` defaults to [[]] (empty domain — safe default for search-style
        calls that receive an explicit domain anyway).
        """
        return _models().execute_kw(
            self.db,
            self.uid,
            self.password,
            model,
            method,
            args   if args   is not None else [[]],
            kwargs if kwargs is not None else {},
        )

    # ── Read helpers ──────────────────────────────────────────────────────────

    def search_read(
        self,
        model: str,
        domain: list,
        fields: list[str],
        **kw: Any,
    ) -> list[dict]:
        """
        Return records matching `domain`.
        Extra keyword args (limit, offset, order) are forwarded as kwargs.
        """
        return self.execute(
            model,
            "search_read",
            [domain],
            {"fields": fields, **kw},
        )

    def read(
        self,
        model: str,
        ids: list[int],
        fields: list[str],
        **kw: Any,
    ) -> list[dict]:
        """Read specific records by ID list."""
        return self.execute(model, "read", [ids], {"fields": fields, **kw})

    def read_group(
        self,
        model: str,
        domain: list,
        fields: list[str],
        groupby: list[str],
        **kw: Any,
    ) -> list[dict]:
        """
        Aggregation query.  Used for state-count tabs on the dashboard.

        Note: the count key differs across Odoo versions —
        "state_count" (14+) vs "__count" (some older builds).
        Callers handle both via: `g.get("state_count") or g.get("__count") or 0`
        """
        return self.execute(model, "read_group", [domain, fields, groupby], kw)

    # ── Write helpers ─────────────────────────────────────────────────────────

    def write(self, model: str, ids: list[int] | int, vals: dict) -> bool:
        """Update fields on existing records."""
        id_list = [ids] if isinstance(ids, int) else list(ids)
        return self.execute(model, "write", [id_list, vals])

    def create(self, model: str, vals: dict) -> int:
        """Create one record, return its new ID."""
        return self.execute(model, "create", [vals])

    def unlink(self, model: str, ids: list[int]) -> bool:
        """Permanently delete records (no recycle bin)."""
        return self.execute(model, "unlink", [ids])

    def call(
        self,
        model: str,
        method: str,
        ids: list[int] | int,
        **kw: Any,
    ) -> Any:
        """
        Invoke a model action method (button_confirm, button_cancel, …).

        `ids` can be a single int or a list — both are normalised to a list
        so the XML-RPC envelope is always `[[id, …], {}]`.
        """
        id_list = [ids] if isinstance(ids, int) else list(ids)
        return self.execute(model, method, [id_list], kw or {})

    # ── Parallel runner ───────────────────────────────────────────────────────

    @staticmethod
    def parallel(*fns: Callable[[], Any]) -> list[Any]:
        """
        Run N zero-argument callables concurrently.
        Returns results in the same order as the callables.

        Because every OdooSession call creates its own fresh proxy, running
        two lambdas that both capture the same session is thread-safe.

        Example — two independent Odoo round-trips in one wall-clock RTT:

            lines, swipes = s.parallel(
                lambda: s.read("meal.order.line", line_ids, ["employee_id"]),
                lambda: s.search_read("hr.employee.meal", swipe_domain, ["employee_id"]),
            )

        Single-callable case skips the thread pool entirely.
        """
        n = len(fns)
        if n == 0:
            return []
        if n == 1:
            return [fns[0]()]
        with ThreadPoolExecutor(max_workers=n) as pool:
            futures = [pool.submit(fn) for fn in fns]
            return [f.result() for f in futures]


# ── Session factories ─────────────────────────────────────────────────────────

def admin_session() -> OdooSession:
    """
    Return an OdooSession for the service-account admin.

    The UID is served from the 1-hour cache in odoo.client — no extra
    authenticate() round-trip after the first login.
    """
    return OdooSession(ODOO_DB, _admin_uid(), ODOO_PASSWORD)


def user_session(uid: int, password: str) -> OdooSession:
    """
    Return an OdooSession authenticated as the given user.
    Used when an audit trail is required (order creation).
    """
    return OdooSession(ODOO_DB, uid, password)
