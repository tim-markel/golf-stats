"""FastAPI application entry point.

Run locally:
    uvicorn api.main:app --reload
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import pool
from .routers import courses, golfers, rounds, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    try:
        yield
    finally:
        pool.close()


app = FastAPI(title="golf-stats API", version="0.1.0", lifespan=lifespan)

# Allow the Next.js dev server (and a deployed frontend) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(golfers.router)
app.include_router(courses.router)
app.include_router(rounds.router)
app.include_router(stats.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
