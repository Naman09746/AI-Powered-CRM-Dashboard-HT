def test_login_success(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "test_admin@crm.com", "password": "Admin123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "test_admin@crm.com", "password": "WrongPassword!"},
    )
    assert response.status_code == 400


def test_login_invalid_user(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "nonexistent@crm.com", "password": "Admin123!"},
    )
    assert response.status_code == 400


def test_auth_me_authenticated(client, admin_token):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test_admin@crm.com"
    assert data["role"] == "Admin"


def test_auth_me_unauthorized(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_admin_access_to_users_list(client, admin_token):
    response = client.get(
        "/api/v1/users/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 3


def test_executive_role_restrictions_on_reports(client, exec_token):
    # Executive should not access manager/admin operational reports
    response = client.get(
        "/api/v1/reports/",
        headers={"Authorization": f"Bearer {exec_token}"},
    )
    assert response.status_code == 403
