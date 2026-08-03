"""Test-wide environment. Applied before any application module is imported."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

# The mock provider keeps the suite offline and key-free.
os.environ["LLM_PROVIDER"] = "mock"
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

_TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="poc-travel-tests-"))
os.environ["DATABASE_PATH"] = str(_TEST_DB_DIR / "travel.db")


@pytest.fixture
def anyio_backend() -> str:
    """anyio's pytest plugin drives `@pytest.mark.anyio` tests through this."""
    return "asyncio"
