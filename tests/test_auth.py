"""Smoke tests for auth and profile endpoints."""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from tests.conftest import make_mock_db


def _user_doc(email="test@example.com", name="Test User", pw_hash=None):
    import hashlib, secrets
    if pw_hash is None:
        salt = secrets.token_hex(16)
        h = hashlib.pbkdf2_hmac("sha256", b"password123", salt.encode(), 200_000)
        pw_hash = f"{salt}${h.hex()}"
    return {
        "user_id": "user_abc123",
        "email": email,
        "name": name,
        "password_hash": pw_hash,
        "provider": "password",
        "profile_id": "prof_abc123",
    }


@pytest.fixture
def app_with_mock_db(mock_db):
    with patch("backend.server.db", mock_db):
        from backend.server import app
        yield app, mock_db


@pytest.mark.asyncio
async def test_signup_success(app_with_mock_db):
    app, db = app_with_mock_db
    db.users.find_one = AsyncMock(return_value=None)
    db.profiles.find_one = AsyncMock(return_value=None)
    db.profiles.insert_one = AsyncMock()
    db.users.insert_one = AsyncMock()
    db.profiles.update_one = AsyncMock()
    db.user_sessions.insert_one = AsyncMock()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/auth/signup", json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "securepass123",
        })
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["user"]["email"] == "alice@example.com"


@pytest.mark.asyncio
async def test_signup_duplicate_email(app_with_mock_db):
    app, db = app_with_mock_db
    db.users.find_one = AsyncMock(return_value=_user_doc("alice@example.com"))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/auth/signup", json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "securepass123",
        })
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_signup_weak_password(app_with_mock_db):
    app, db = app_with_mock_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/auth/signup", json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "short",
        })
    assert r.status_code == 400
    assert "8" in r.json()["detail"]


@pytest.mark.asyncio
async def test_signup_blank_name(app_with_mock_db):
    app, db = app_with_mock_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/auth/signup", json={
            "name": "   ",
            "email": "alice@example.com",
            "password": "securepass123",
        })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_signin_wrong_password(app_with_mock_db):
    app, db = app_with_mock_db
    db.users.find_one = AsyncMock(return_value=_user_doc())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/auth/signin", json={
            "email": "test@example.com",
            "password": "wrongpassword",
        })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_profile_invalid_goal(app_with_mock_db):
    app, db = app_with_mock_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/profile", json={
            "name": "Bob",
            "goal": "become_a_wizard",
            "level": "beginner",
            "days_per_week": 3,
        })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_profile_invalid_days(app_with_mock_db):
    app, db = app_with_mock_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/profile", json={
            "name": "Bob",
            "goal": "muscle_gain",
            "level": "beginner",
            "days_per_week": 0,
        })
    assert r.status_code == 400
