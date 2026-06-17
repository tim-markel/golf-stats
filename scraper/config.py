"""Configuration loaded from environment / .env."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    gemini_api_key: str
    tavily_api_key: str
    database_url: str
    gemini_model: str

    @classmethod
    def load(cls) -> "Config":
        missing = [
            name
            for name in ("GEMINI_API_KEY", "TAVILY_API_KEY")
            if not os.environ.get(name)
        ]
        if missing:
            raise RuntimeError(
                f"Missing required env var(s): {', '.join(missing)}. "
                "Copy .env.example to .env and fill them in."
            )
        return cls(
            gemini_api_key=os.environ["GEMINI_API_KEY"],
            tavily_api_key=os.environ["TAVILY_API_KEY"],
            database_url=os.environ.get(
                "DATABASE_URL", "postgresql://localhost:5432/golf_stats"
            ),
            gemini_model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        )
