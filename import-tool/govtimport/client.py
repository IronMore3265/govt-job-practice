"""A small Supabase REST and Storage client (requests only), written like the MSc site's tool.

The service role key bypasses RLS, so it lives only in import-tool/.env (git-ignored). Run this tool from your own laptop.
"""
import os
from pathlib import Path
from urllib.parse import quote

import requests

TOOL_DIR = Path(__file__).resolve().parents[1]
PAGE = 1000  # PostgREST returns at most 1000 rows per request


def load_env(path: Path | None = None) -> dict:
    """KEY=VALUE lines from import-tool/.env. Real environment variables win."""
    values: dict = {}
    path = path or TOOL_DIR / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if os.environ.get(k):
            values[k] = os.environ[k]
    return values


class Supabase:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.http = requests.Session()
        # Legacy keys are JWTs and go in both headers. New sb_secret_ keys go in apikey only.
        self.http.headers["apikey"] = key
        if key.startswith("eyJ"):
            self.http.headers["Authorization"] = f"Bearer {key}"

    @classmethod
    def from_env(cls) -> "Supabase":
        env = load_env()
        if not env.get("SUPABASE_URL") or not env.get("SUPABASE_SERVICE_ROLE_KEY"):
            raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in import-tool/.env (copy .env.example).")
        return cls(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    def _rest(self, method: str, table: str, *, params=None, json=None, headers=None):
        r = self.http.request(method, f"{self.url}/rest/v1/{table}", params=params, json=json, headers=headers or {}, timeout=60)
        if not r.ok:
            raise RuntimeError(f"{method} {table} failed ({r.status_code}): {r.text[:300]}")
        return r

    def select(self, table: str, params: dict | None = None) -> list[dict]:
        """All rows that match, following the 1000 row page limit."""
        rows: list[dict] = []
        while True:
            headers = {"Range-Unit": "items", "Range": f"{len(rows)}-{len(rows) + PAGE - 1}"}
            chunk = self._rest("GET", table, params=params, headers=headers).json()
            rows += chunk
            if len(chunk) < PAGE:
                return rows

    def insert(self, table: str, rows: list[dict]) -> list[dict]:
        return self._rest("POST", table, json=rows, headers={"Prefer": "return=representation"}).json()

    def update(self, table: str, params: dict, values: dict) -> list[dict]:
        return self._rest("PATCH", table, params=params, json=values, headers={"Prefer": "return=representation"}).json()

    def delete(self, table: str, params: dict) -> None:
        self._rest("DELETE", table, params=params)

    def put_object(self, bucket: str, path: str, data: bytes, mime: str) -> None:
        r = self.http.post(
            f"{self.url}/storage/v1/object/{bucket}/{quote(path)}",
            data=data, headers={"Content-Type": mime, "x-upsert": "true", "Cache-Control": "max-age=31536000"}, timeout=180,
        )
        if not r.ok:
            raise RuntimeError(f"Storage upload of {bucket}/{path} failed ({r.status_code}): {r.text[:300]}")
