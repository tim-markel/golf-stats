"""FastAPI application entry point.

Run locally:
    uvicorn api.main:app --reload
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .db import pool
from .ratelimit import limiter
from .auth import router as auth_router
from .routers import (
    beers,
    courses,
    golfers,
    leaderboard,
    practice,
    rounds,
    stats,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    try:
        yield
    finally:
        pool.close()


app = FastAPI(title="golf-stats API", version="0.1.0", lifespan=lifespan)

# Rate limiting (see api/ratelimit.py + limits on the auth endpoints).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allowed browser origins. Defaults to the local dev server; set CORS_ORIGINS
# (comma-separated) in production to your real frontend origin(s).
_CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Impersonate-Golfer-Id"],
)

app.include_router(auth_router)
app.include_router(golfers.router)
app.include_router(courses.router)
app.include_router(beers.router)
app.include_router(rounds.router)
app.include_router(stats.router)
app.include_router(leaderboard.router)
app.include_router(practice.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
