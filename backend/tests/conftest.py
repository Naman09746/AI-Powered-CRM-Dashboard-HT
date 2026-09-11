import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Force testing configuration
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-testing"

from app.core.database import Base, get_db

from app.core.security import get_password_hash
from app.main import app
from app.models.user import User
from app.models.crm import Company, Contact, Lead, Deal, Prospect, OutreachResult

# Create test SQLite in-memory engine
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Seed test users
    admin = User(
        email="test_admin@crm.com",
        hashed_password=get_password_hash("Admin123!"),
        full_name="Test Admin",
        role="Admin",
        is_active=True,
    )
    manager = User(
        email="test_manager@crm.com",
        hashed_password=get_password_hash("Manager123!"),
        full_name="Test Manager",
        role="Manager",
        is_active=True,
    )
    exec_user = User(
        email="test_exec@crm.com",
        hashed_password=get_password_hash("Exec123!"),
        full_name="Test Executive",
        role="Executive",
        is_active=True,
    )
    session.add_all([admin, manager, exec_user])
    session.commit()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "test_admin@crm.com", "password": "Admin123!"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def exec_token(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "test_exec@crm.com", "password": "Exec123!"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]

