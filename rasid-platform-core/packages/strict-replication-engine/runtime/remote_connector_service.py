from __future__ import annotations

import argparse
import json
import os
import sqlite3
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_database(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS metrics (
            dataset TEXT NOT NULL,
            region TEXT NOT NULL,
            period TEXT NOT NULL,
            metric TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (dataset, region, period, metric)
        );
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            dataset TEXT NOT NULL,
            region TEXT NOT NULL,
            period TEXT NOT NULL,
            baseline_region TEXT NOT NULL,
            baseline_period TEXT NOT NULL,
            tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
            permission_state TEXT NOT NULL DEFAULT 'analyst',
            drill_metric TEXT,
            refresh_count INTEGER NOT NULL,
            compare_payload TEXT,
            export_count INTEGER NOT NULL DEFAULT 0,
            export_payload TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS refresh_log (
            refresh_id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            dataset TEXT NOT NULL,
            region TEXT NOT NULL,
            period TEXT NOT NULL,
            refresh_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    metric_count = connection.execute("SELECT COUNT(*) AS count FROM metrics").fetchone()["count"]
    if metric_count == 0:
        connection.executemany(
            "INSERT INTO metrics (dataset, region, period, metric, value) VALUES (?, ?, ?, ?, ?)",
            [
                ("sales_live", "KSA", "2026-Q1", "Growth", "17%"),
                ("sales_live", "KSA", "2026-Q1", "Orders", "128"),
                ("sales_live", "KSA", "2026-Q1", "Sales", "210"),
                ("sales_live", "KSA", "2026-Q2", "Growth", "19%"),
                ("sales_live", "KSA", "2026-Q2", "Orders", "135"),
                ("sales_live", "KSA", "2026-Q2", "Sales", "224"),
                ("sales_live", "UAE", "2026-Q1", "Growth", "11%"),
                ("sales_live", "UAE", "2026-Q1", "Orders", "97"),
                ("sales_live", "UAE", "2026-Q1", "Sales", "175"),
                ("sales_live", "UAE", "2026-Q2", "Growth", "13%"),
                ("sales_live", "UAE", "2026-Q2", "Orders", "104"),
                ("sales_live", "UAE", "2026-Q2", "Sales", "186")
            ],
        )
        connection.commit()
    existing_columns = {row["name"] for row in connection.execute("PRAGMA table_info(sessions)").fetchall()}
    if "tenant_id" not in existing_columns:
        connection.execute("ALTER TABLE sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tenant-default'")
    if "permission_state" not in existing_columns:
        connection.execute("ALTER TABLE sessions ADD COLUMN permission_state TEXT NOT NULL DEFAULT 'analyst'")
    if "export_count" not in existing_columns:
        connection.execute("ALTER TABLE sessions ADD COLUMN export_count INTEGER NOT NULL DEFAULT 0")
    if "export_payload" not in existing_columns:
        connection.execute("ALTER TABLE sessions ADD COLUMN export_payload TEXT")
    connection.commit()
    return connection


def permission_profile(permission_state: str) -> dict[str, bool]:
    profiles = {
        "viewer": {"filter": True, "drill": False, "refresh": False, "compare": True, "export": False},
        "executive": {"filter": True, "drill": True, "refresh": False, "compare": True, "export": True},
        "operator": {"filter": True, "drill": True, "refresh": True, "compare": True, "export": True},
        "admin": {"filter": True, "drill": True, "refresh": True, "compare": True, "export": True},
        "analyst": {"filter": True, "drill": True, "refresh": True, "compare": True, "export": True},
    }
    return profiles.get(permission_state, profiles["analyst"]).copy()


def fetch_metrics(connection: sqlite3.Connection, dataset: str, region: str, period: str) -> dict[str, str]:
    if dataset == "github_repo":
        request = urllib.request.Request(
            f"https://api.github.com/repos/{region}/{period}",
            headers={
                "User-Agent": "rasid-strict-replication-engine",
                **(
                    {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"}
                    if os.environ.get("GITHUB_TOKEN")
                    else {}
                ),
            },
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return {
            "Stars": str(payload.get("stargazers_count", 0)),
            "Forks": str(payload.get("forks_count", 0)),
            "OpenIssues": str(payload.get("open_issues_count", 0)),
            "Watchers": str(payload.get("subscribers_count", 0)),
        }
    rows = connection.execute(
        "SELECT metric, value FROM metrics WHERE dataset = ? AND region = ? AND period = ? ORDER BY metric",
        (dataset, region, period),
    ).fetchall()
    if not rows:
        raise KeyError(f"dataset_not_found:{dataset}:{region}:{period}")
    return {row["metric"]: row["value"] for row in rows}


def build_snapshot(connection: sqlite3.Connection, session_id: str) -> dict[str, Any]:
    row = connection.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    if row is None:
        raise KeyError(f"session_not_found:{session_id}")
    metrics = fetch_metrics(connection, row["dataset"], row["region"], row["period"])
    rows = [["Metric", "Value"], *[[metric, value] for metric, value in sorted(metrics.items())]]
    compare_payload = json.loads(row["compare_payload"]) if row["compare_payload"] else None
    export_payload = json.loads(row["export_payload"]) if row["export_payload"] else None
    return {
        "session": {
            "session_id": row["session_id"],
            "dataset": row["dataset"],
            "region": row["region"],
            "period": row["period"],
            "tenant_id": row["tenant_id"],
            "permission_state": row["permission_state"],
            "refresh_count": row["refresh_count"],
            "export_count": row["export_count"],
            "updated_at": row["updated_at"],
        },
        "title": "LIVE SALES DASHBOARD",
        "rows": rows,
        "metrics": metrics,
        "drill_metric": row["drill_metric"],
        "compare": compare_payload,
        "export_payload": export_payload,
        "permissions": permission_profile(row["permission_state"]),
        "query_ref": f"remote://{row['dataset']}/{row['region']}/{row['period']}",
    }


def update_session(connection: sqlite3.Connection, session_id: str, *, region: str | None = None, period: str | None = None, drill_metric: str | None = None, compare_payload: dict[str, Any] | None = None) -> None:
    row = connection.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    if row is None:
        raise KeyError(f"session_not_found:{session_id}")
    connection.execute(
        """
        UPDATE sessions
        SET region = ?, period = ?, drill_metric = ?, compare_payload = ?, updated_at = ?
        WHERE session_id = ?
        """,
        (
            region if region is not None else row["region"],
            period if period is not None else row["period"],
            drill_metric if drill_metric is not None else row["drill_metric"],
            json.dumps(compare_payload) if compare_payload is not None else None,
            now(),
            session_id,
        ),
    )
    connection.commit()


def export_session(connection: sqlite3.Connection, session_id: str) -> None:
    row = connection.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    if row is None:
        raise KeyError(f"session_not_found:{session_id}")
    permissions = permission_profile(row["permission_state"])
    if not permissions["export"]:
        raise PermissionError(f"export_forbidden:{row['permission_state']}")
    metrics = fetch_metrics(connection, row["dataset"], row["region"], row["period"])
    export_payload = {
        "format": "csv",
        "row_count": len(metrics),
        "exported_metric_names": sorted(metrics.keys()),
        "tenant_id": row["tenant_id"],
        "permission_state": row["permission_state"],
        "exported_at": now(),
    }
    connection.execute(
        "UPDATE sessions SET export_count = export_count + 1, export_payload = ?, updated_at = ? WHERE session_id = ?",
        (json.dumps(export_payload), now(), session_id),
    )
    connection.commit()


def refresh_session(connection: sqlite3.Connection, session_id: str) -> None:
    row = connection.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    if row is None:
        raise KeyError(f"session_not_found:{session_id}")
    if row["dataset"] == "github_repo":
        fetch_metrics(connection, row["dataset"], row["region"], row["period"])
        connection.execute(
            "UPDATE sessions SET refresh_count = refresh_count + 1, updated_at = ?, compare_payload = NULL WHERE session_id = ?",
            (now(), session_id),
        )
        connection.execute(
            "INSERT INTO refresh_log (session_id, dataset, region, period, refresh_count, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, row["dataset"], row["region"], row["period"], row["refresh_count"] + 1, now()),
        )
        connection.commit()
        return
    metrics = fetch_metrics(connection, row["dataset"], row["region"], row["period"])
    connection.execute(
        "UPDATE metrics SET value = ? WHERE dataset = ? AND region = ? AND period = ? AND metric = 'Sales'",
        (str(int(metrics["Sales"]) + 3), row["dataset"], row["region"], row["period"]),
    )
    connection.execute(
        "UPDATE metrics SET value = ? WHERE dataset = ? AND region = ? AND period = ? AND metric = 'Orders'",
        (str(int(metrics["Orders"]) + 1), row["dataset"], row["region"], row["period"]),
    )
    connection.execute(
        "UPDATE sessions SET refresh_count = refresh_count + 1, updated_at = ?, compare_payload = NULL WHERE session_id = ?",
        (now(), session_id),
    )
    connection.execute(
        "INSERT INTO refresh_log (session_id, dataset, region, period, refresh_count, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, row["dataset"], row["region"], row["period"], row["refresh_count"] + 1, now()),
    )
    connection.commit()


def compare_session(connection: sqlite3.Connection, session_id: str) -> None:
    row = connection.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    if row is None:
        raise KeyError(f"session_not_found:{session_id}")
    current_metrics = fetch_metrics(connection, row["dataset"], row["region"], row["period"])
    baseline_metrics = fetch_metrics(connection, row["dataset"], row["baseline_region"], row["baseline_period"])
    deltas = []
    for metric, current_value in sorted(current_metrics.items()):
        baseline_value = baseline_metrics.get(metric, "0")
        if current_value.endswith("%"):
            delta = f"{int(current_value.rstrip('%')) - int(baseline_value.rstrip('%')):+d}pp"
        else:
            delta = int(current_value) - int(baseline_value)
        deltas.append({"metric": metric, "current": current_value, "baseline": baseline_value, "delta": delta})
    update_session(
        connection,
        session_id,
        compare_payload={
            "baseline_region": row["baseline_region"],
            "baseline_period": row["baseline_period"],
            "deltas": deltas,
        },
    )


def render_dashboard_html(base_url: str, session_id: str, token: str, snapshot: dict[str, Any]) -> str:
    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>{snapshot['title']}</title>
    <style>
      body {{ font-family: Arial, sans-serif; background: #ffffff; margin: 0; }}
      .wrap {{ width: 1120px; padding: 20px; }}
      .toolbar {{ display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 18px; }}
      .badge {{ border: 1px solid #000; background: #eef6ff; padding: 8px 10px; }}
      .control-row {{ display: flex; gap: 8px; margin-bottom: 14px; }}
      .title {{ background: #ddeeff; border: 1px solid #000; padding: 14px 20px; width: 220px; }}
      .cards {{ display: flex; gap: 12px; margin-top: 20px; }}
      .card {{ border: 1px solid #000; background: #f8fbff; padding: 12px; min-width: 150px; }}
      .metric {{ font-size: 14px; }}
      .value {{ font-size: 22px; margin-top: 6px; }}
      table {{ border-collapse: collapse; margin-top: 24px; width: 460px; }}
      td {{ border: 1px solid #000; padding: 8px 10px; }}
      #compare-panel {{ margin-top: 18px; border: 1px solid #000; background: #fffbe6; padding: 12px; display: none; width: 520px; }}
      #state-json {{ display: none; }}
      button, select {{ font-size: 14px; padding: 6px 10px; }}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="toolbar">
        <div class="badge" id="badge-region">Region</div>
        <div class="badge" id="badge-period">Period</div>
        <div class="badge" id="badge-tenant">Tenant</div>
        <div class="badge" id="badge-permission">Permission</div>
        <div class="badge" id="badge-drill">Drill</div>
        <div class="badge" id="badge-refresh">Refreshes</div>
        <div class="badge" id="badge-export">Exports</div>
      </div>
      <div class="control-row">
        <select id="region-filter">
          <option value="KSA">KSA</option>
          <option value="UAE">UAE</option>
        </select>
        <select id="period-filter">
          <option value="2026-Q1">2026-Q1</option>
          <option value="2026-Q2">2026-Q2</option>
        </select>
        <button id="apply-filter" type="button">Apply Filter</button>
        <button id="drill-sales" type="button">Drill Sales</button>
        <button id="refresh-button" type="button">Refresh</button>
        <button id="compare-button" type="button">Compare</button>
        <button id="export-button" type="button">Export</button>
      </div>
      <div class="title" id="dashboard-title"></div>
      <div class="cards" id="cards"></div>
      <table id="metrics-table"></table>
      <div id="compare-panel"></div>
      <div id="export-panel"></div>
      <pre id="state-json"></pre>
    </div>
    <script>
      const SESSION_ID = {json.dumps(session_id)};
      const ACCESS_TOKEN = {json.dumps(token)};
      const BASE_URL = {json.dumps(base_url)};
      const requestJson = async (path, method = "GET", body = null) => {{
        const response = await fetch(`${{BASE_URL}}${{path}}`, {{
          method,
          headers: {{
            "Authorization": `Bearer ${{ACCESS_TOKEN}}`,
            "Content-Type": "application/json"
          }},
          body: body ? JSON.stringify(body) : null
        }});
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
      }};
      const render = (payload) => {{
        const snapshot = payload.snapshot ?? payload;
        document.getElementById("badge-region").textContent = `Region: ${{snapshot.session.region}}`;
        document.getElementById("badge-period").textContent = `Period: ${{snapshot.session.period}}`;
        document.getElementById("badge-tenant").textContent = `Tenant: ${{snapshot.session.tenant_id}}`;
        document.getElementById("badge-permission").textContent = `Permission: ${{snapshot.session.permission_state}}`;
        document.getElementById("badge-drill").textContent = `Drill: ${{snapshot.drill_metric || "none"}}`;
        document.getElementById("badge-refresh").textContent = `Refreshes: ${{snapshot.session.refresh_count}}`;
        document.getElementById("badge-export").textContent = `Exports: ${{snapshot.session.export_count}}`;
        document.getElementById("dashboard-title").textContent = snapshot.title;
        document.getElementById("region-filter").value = snapshot.session.region;
        document.getElementById("period-filter").value = snapshot.session.period;
        document.getElementById("apply-filter").disabled = !snapshot.permissions.filter;
        document.getElementById("drill-sales").disabled = !snapshot.permissions.drill;
        document.getElementById("refresh-button").disabled = !snapshot.permissions.refresh;
        document.getElementById("compare-button").disabled = !snapshot.permissions.compare;
        document.getElementById("export-button").disabled = !snapshot.permissions.export;
        document.getElementById("cards").innerHTML = snapshot.rows.slice(1).map((row) => `<div class="card"><div class="metric">${{row[0]}}</div><div class="value">${{row[1]}}</div></div>`).join("");
        document.getElementById("metrics-table").innerHTML = snapshot.rows.map((row) => `<tr>${{row.map((cell) => `<td>${{cell}}</td>`).join("")}}</tr>`).join("");
        const comparePanel = document.getElementById("compare-panel");
        if (snapshot.compare) {{
          comparePanel.style.display = "block";
          comparePanel.innerHTML = `<strong>Compare vs ${{snapshot.compare.baseline_region}} / ${{snapshot.compare.baseline_period}}</strong><ul>${{snapshot.compare.deltas.map((delta) => `<li>${{delta.metric}}: ${{delta.current}} vs ${{delta.baseline}} (${{delta.delta}})</li>`).join("")}}</ul>`;
        }} else {{
          comparePanel.style.display = "none";
          comparePanel.textContent = "";
        }}
        const exportPanel = document.getElementById("export-panel");
        if (snapshot.export_payload) {{
          exportPanel.style.display = "block";
          exportPanel.innerHTML = `<strong>Export ${{snapshot.export_payload.format.toUpperCase()}}</strong><div>Rows: ${{snapshot.export_payload.row_count}}</div><div>Tenant: ${{snapshot.export_payload.tenant_id}}</div>`;
        }} else {{
          exportPanel.style.display = "none";
          exportPanel.textContent = "";
        }}
        document.getElementById("state-json").textContent = JSON.stringify(snapshot);
      }};
      const loadState = async () => render(await requestJson(`/api/session/${{SESSION_ID}}/state`));
      document.getElementById("apply-filter").addEventListener("click", async () => {{
        render(await requestJson(`/api/session/${{SESSION_ID}}/filter`, "POST", {{
          region: document.getElementById("region-filter").value,
          period: document.getElementById("period-filter").value
        }}));
      }});
      document.getElementById("drill-sales").addEventListener("click", async () => {{
        render(await requestJson(`/api/session/${{SESSION_ID}}/drill`, "POST", {{ metric: "Sales" }}));
      }});
      document.getElementById("refresh-button").addEventListener("click", async () => {{
        render(await requestJson(`/api/session/${{SESSION_ID}}/refresh`, "POST", {{ action: "refresh" }}));
      }});
      document.getElementById("compare-button").addEventListener("click", async () => {{
        render(await requestJson(`/api/session/${{SESSION_ID}}/compare`, "POST", {{ action: "compare" }}));
      }});
      document.getElementById("export-button").addEventListener("click", async () => {{
        render(await requestJson(`/api/session/${{SESSION_ID}}/export`, "POST", {{ format: "csv" }}));
      }});
      loadState();
    </script>
  </body>
</html>"""


class RemoteConnectorHandler(BaseHTTPRequestHandler):
    connection_handle: sqlite3.Connection | None = None
    access_token: str = ""
    base_url: str = ""

    def _json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorize(self) -> bool:
        return self.headers.get("Authorization", "") == f"Bearer {self.access_token}"

    def _body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        assert self.connection_handle is not None
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._json({"ok": True, "base_url": self.base_url})
            return
        if parsed.path.startswith("/api/session/") and parsed.path.endswith("/state"):
            if not self._authorize():
                self._json({"ok": False, "error": "unauthorized"}, status=401)
                return
            session_id = parsed.path.split("/")[3]
            try:
                self._json({"ok": True, "snapshot": build_snapshot(self.connection_handle, session_id)})
            except KeyError as error:
                self._json({"ok": False, "error": str(error)}, status=404)
            return
        if parsed.path.startswith("/dashboard/"):
            session_id = parsed.path.split("/")[2]
            token = parse_qs(parsed.query).get("access_token", [""])[0]
            if token != self.access_token:
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"forbidden")
                return
            try:
                snapshot = build_snapshot(self.connection_handle, session_id)
            except KeyError:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"missing")
                return
            body = render_dashboard_html(self.base_url, session_id, self.access_token, snapshot).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self._json({"ok": False, "error": "not_found"}, status=404)

    def do_POST(self) -> None:
        assert self.connection_handle is not None
        if not self._authorize():
            self._json({"ok": False, "error": "unauthorized"}, status=401)
            return
        payload = self._body()
        try:
            if self.path == "/api/session/start":
                dataset = payload.get("dataset", "sales_live")
                session_id = payload["session_id"]
                region = payload.get("region", "KSA")
                period = payload.get("period", "2026-Q1")
                permission_state = payload.get("permission_state", "analyst")
                tenant_id = payload.get("tenant_id", "tenant-default")
                fetch_metrics(self.connection_handle, dataset, region, period)
                self.connection_handle.execute(
                    """
                    INSERT OR REPLACE INTO sessions
                    (session_id, dataset, region, period, baseline_region, baseline_period, tenant_id, permission_state, drill_metric, refresh_count, compare_payload, export_count, export_payload, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, 0, NULL, ?)
                    """,
                    (session_id, dataset, region, period, region, period, tenant_id, permission_state, now()),
                )
                self.connection_handle.commit()
                self._json(
                    {
                        "ok": True,
                        "snapshot": build_snapshot(self.connection_handle, session_id),
                        "dashboard_url": f"{self.base_url}/dashboard/{session_id}?access_token={self.access_token}",
                        "auth": {
                            "mode": "bearer",
                            "token_present": bool(os.environ.get("GITHUB_TOKEN")),
                            "token_source": os.environ.get("GITHUB_TOKEN_SOURCE"),
                            "provider": "github-rest-api" if dataset == "github_repo" else "sqlite-local",
                        },
                    }
                )
                return
            if self.path.endswith("/filter"):
                session_id = self.path.split("/")[3]
                update_session(self.connection_handle, session_id, region=payload.get("region"), period=payload.get("period"), compare_payload=None)
                self._json({"ok": True, "snapshot": build_snapshot(self.connection_handle, session_id)})
                return
            if self.path.endswith("/drill"):
                session_id = self.path.split("/")[3]
                row = self.connection_handle.execute("SELECT permission_state FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
                if row is None:
                    raise KeyError(f"session_not_found:{session_id}")
                if not permission_profile(row["permission_state"])["drill"]:
                    raise PermissionError(f"drill_forbidden:{row['permission_state']}")
                update_session(self.connection_handle, session_id, drill_metric=payload.get("metric"), compare_payload=None)
                self._json({"ok": True, "snapshot": build_snapshot(self.connection_handle, session_id)})
                return
            if self.path.endswith("/refresh"):
                session_id = self.path.split("/")[3]
                row = self.connection_handle.execute("SELECT permission_state FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
                if row is None:
                    raise KeyError(f"session_not_found:{session_id}")
                if not permission_profile(row["permission_state"])["refresh"]:
                    raise PermissionError(f"refresh_forbidden:{row['permission_state']}")
                refresh_session(self.connection_handle, session_id)
                self._json({"ok": True, "snapshot": build_snapshot(self.connection_handle, session_id)})
                return
            if self.path.endswith("/compare"):
                session_id = self.path.split("/")[3]
                row = self.connection_handle.execute("SELECT permission_state FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
                if row is None:
                    raise KeyError(f"session_not_found:{session_id}")
                if not permission_profile(row["permission_state"])["compare"]:
                    raise PermissionError(f"compare_forbidden:{row['permission_state']}")
                compare_session(self.connection_handle, session_id)
                self._json({"ok": True, "snapshot": build_snapshot(self.connection_handle, session_id)})
                return
            if self.path.endswith("/export"):
                session_id = self.path.split("/")[3]
                export_session(self.connection_handle, session_id)
                self._json({"ok": True, "snapshot": build_snapshot(self.connection_handle, session_id)})
                return
        except KeyError as error:
            self._json({"ok": False, "error": str(error)}, status=404)
            return
        except PermissionError as error:
            self._json({"ok": False, "error": str(error)}, status=403)
            return
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            self._json(
                {
                    "ok": False,
                    "error": "provider_http_error",
                    "status": error.code,
                    "reason": error.reason,
                    "provider": "github-rest-api",
                    "response_excerpt": body[:800],
                },
                status=error.code,
            )
            return
        except Exception as error:
            self._json(
                {
                    "ok": False,
                    "error": "provider_runtime_error",
                    "provider": "github-rest-api",
                    "details": str(error),
                },
                status=502,
            )
            return
        self._json({"ok": False, "error": "not_found"}, status=404)

    def log_message(self, format: str, *args: Any) -> None:
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--db-path", type=Path, required=True)
    parser.add_argument("--token", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    connection = ensure_database(args.db_path)
    RemoteConnectorHandler.connection_handle = connection
    RemoteConnectorHandler.access_token = args.token
    RemoteConnectorHandler.base_url = f"http://127.0.0.1:{args.port}"
    server = ThreadingHTTPServer(("127.0.0.1", args.port), RemoteConnectorHandler)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        connection.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
