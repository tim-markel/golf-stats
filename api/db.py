"""Database connection pool, shared across requests."""
from __future__ import annotations

import os

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://localhost:5432/golf_stats"
)

# Opened on app startup (see main.lifespan). dict_row -> rows come back as dicts.
#
# Serverless Postgres (Neon) suspends its compute when idle and terminates the
# server side of long-lived pooled connections. `check` validates a connection
# before it's handed to a request, so a killed connection is transparently
# replaced instead of blowing up with AdminShutdown. `max_idle` recycles idle
# connections proactively (well under Neon's suspend window). `prepare_threshold
# =None` disables psycopg's auto-prepared statements, which aren't supported by
# Neon's PgBouncer (`-pooler`) transaction-pooling endpoint.
pool = ConnectionPool(
    DATABASE_URL,
    open=False,
    kwargs={"row_factory": dict_row, "prepare_threshold": None},
    check=ConnectionPool.check_connection,
    max_idle=60,
)
