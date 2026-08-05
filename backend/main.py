"""FastAPI application entry point.

uvicorn main:app --reload
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from database.db import connect, init_schema  # noqa: E402  (needs env loaded)
from routes.recommendations import router as recommendations_router  # noqa: E402
from services.llm_service import DEFAULT_PROVIDER  # noqa: E402

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

DEFAULT_CORS_ORIGINS = "http://localhost:3000"


def _cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Keeps a fresh checkout from 500-ing before `python -m database.seed` runs.
    connection = connect()
    try:
        init_schema(connection)
    finally:
        connection.close()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Voice Travel Recommendation PoC",
        description=(
            "Voice -> text -> LLM -> structured preferences -> database search "
            "-> ranked travel packages."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    app.include_router(recommendations_router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "provider": os.environ.get("LLM_PROVIDER", DEFAULT_PROVIDER),
        }

    return app


app = create_app()
