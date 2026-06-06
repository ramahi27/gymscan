import pytest
import mongomock
from unittest.mock import AsyncMock, MagicMock, patch


def make_async_mock_collection():
    """Return an object that mimics a Motor collection with async methods."""
    col = MagicMock()
    col.find_one = AsyncMock(return_value=None)
    col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="fake_id"))
    col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    col.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
    col.replace_one = AsyncMock(return_value=MagicMock(modified_count=1))
    col.create_index = AsyncMock(return_value="index_name")

    # find() returns a cursor-like object with sort/limit/to_list chaining
    def _make_cursor():
        cursor = MagicMock()
        cursor.sort = MagicMock(return_value=cursor)
        cursor.limit = MagicMock(return_value=cursor)
        cursor.to_list = AsyncMock(return_value=[])
        return cursor

    col.find = MagicMock(side_effect=lambda *a, **kw: _make_cursor())
    return col


def make_mock_db():
    """Return an object that mimics the Motor database, giving an async collection per attribute."""
    db = MagicMock()
    db.__getitem__ = MagicMock(side_effect=lambda name: make_async_mock_collection())
    # Also support attribute access (db.users, db.profiles, etc.)
    for name in ("users", "profiles", "user_sessions", "scans", "plans", "sessions",
                 "media", "exercise_gif_cache"):
        setattr(db, name, make_async_mock_collection())
    return db


@pytest.fixture
def mock_db():
    """Fresh mock DB for each test."""
    return make_mock_db()
