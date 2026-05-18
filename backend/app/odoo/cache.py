"""
Thread-safe TTL cache for Odoo responses.

Design constraints
──────────────────
• Only stable, read-heavy data should be cached here.  Dynamic data
  (order lists, swipe counts) must never be cached — they change on writes.
• Entries expire passively: no background sweeper thread; stale entries are
  evicted on the next `get()` that touches them.
• Suitable for small result sets (< ~500 entries total).  Not LRU — if you
  need eviction under memory pressure, use functools.lru_cache or a dedicated
  cache library instead.

Cache keys and recommended TTLs
────────────────────────────────
  "departments"      → 600 s  (10 min)  — HR restructure is infrequent
  "rental_employees" → 300 s  ( 5 min)  — cohort stable within a shift
  (nothing else cached by default; add as needed)

Invalidation
────────────
• Time-based: auto-expired after TTL.
• Explicit: `odoo_cache.delete(key)` after a write that changes the data.
• Prefix-based: `odoo_cache.invalidate_prefix("emp_")` for grouped keys.

Usage
─────
    from app.odoo.cache import odoo_cache

    depts = odoo_cache.get_or_set(
        "departments",
        lambda: session.search_read("hr.department", [], ["id", "name"]),
        ttl=600,
    )

    # After an HR update that changes departments:
    odoo_cache.delete("departments")
"""
from __future__ import annotations

import threading
import time
from typing import Any, Callable


class TTLCache:
    """
    Thread-safe in-memory cache with per-entry time-to-live.

    All public methods acquire a lock so the cache is safe to share
    across async workers, threads, and `OdooSession.parallel()` calls.
    """

    def __init__(self, default_ttl: float = 300.0) -> None:
        """
        Args:
            default_ttl: Seconds before an entry expires when no explicit
                         ttl is given to `set()` or `get_or_set()`.
        """
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock   = threading.Lock()
        self.default_ttl = default_ttl

    # ── Core ─────────────────────────────────────────────────────────────────

    def get(self, key: str) -> Any:
        """
        Return the cached value, or None if the key is missing or expired.
        Expired entries are removed lazily on access.
        """
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires = entry
            if time.monotonic() > expires:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: float | None = None) -> None:
        """Store value under key, expiring after ttl seconds."""
        expires = time.monotonic() + (ttl if ttl is not None else self.default_ttl)
        with self._lock:
            self._store[key] = (value, expires)

    def delete(self, key: str) -> None:
        """Remove a single entry immediately (use after a write that invalidates it)."""
        with self._lock:
            self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        """Remove all entries whose key starts with `prefix`."""
        with self._lock:
            stale = [k for k in self._store if k.startswith(prefix)]
            for k in stale:
                del self._store[k]

    def clear(self) -> None:
        """Remove every entry.  Useful in tests or after a full Odoo data reload."""
        with self._lock:
            self._store.clear()

    # ── Convenience ───────────────────────────────────────────────────────────

    def get_or_set(
        self,
        key: str,
        fn: Callable[[], Any],
        ttl: float | None = None,
    ) -> Any:
        """
        Return the cached value if present and fresh; otherwise call fn(),
        cache the result, and return it.

        fn() is called *outside* the lock so Odoo round-trips don't block
        other threads from reading the cache.  In the rare concurrent-miss
        case, two threads may both call fn() and the second write wins
        (last-writer-wins, which is safe for read-only Odoo data).
        """
        value = self.get(key)
        if value is not None:
            return value
        value = fn()
        self.set(key, value, ttl)
        return value

    def __len__(self) -> int:
        """Return the number of (possibly stale) entries."""
        with self._lock:
            return len(self._store)

    def __contains__(self, key: str) -> bool:
        """True if the key exists and has not expired."""
        return self.get(key) is not None


# ── Shared singleton ──────────────────────────────────────────────────────────

#: Application-wide Odoo response cache.
#: Import and use this directly — do not instantiate TTLCache elsewhere.
odoo_cache: TTLCache = TTLCache(default_ttl=300.0)
