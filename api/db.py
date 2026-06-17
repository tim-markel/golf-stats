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
pool = ConnectionPool(
    DATABASE_URL,
    open=False,
    kwargs={"row_factory": dict_row},
)
