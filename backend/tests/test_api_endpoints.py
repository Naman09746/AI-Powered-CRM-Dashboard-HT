def test_dashboard_kpis_endpoint(client, admin_token):
    response = client.get(
        "/api/v1/dashboard/kpis",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_leads" in data
    assert "open_deals" in data
    assert "outreach" in data


def test_create_and_fetch_lead(client, admin_token):
    # 1. Create a Lead
    payload = {
        "name": "Rohan Kapoor",
        "company_name": "Kapoor Logistics",
        "industry": "Transportation",
        "country": "India",
        "employee_count": 45,
        "source": "Website",
        "status": "New",
        "notes": "Interested in dispatch ERP",
    }
    create_res = client.post(
        "/api/v1/leads/",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 200, create_res.text
    lead = create_res.json()
    assert lead["name"] == "Rohan Kapoor"
    lead_id = lead["id"]

    # 2. Fetch all leads
    list_res = client.get(
        "/api/v1/leads/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_res.status_code == 200
    res_data = list_res.json()
    leads = res_data.get("items", res_data if isinstance(res_data, list) else [])
    assert any(l["id"] == lead_id for l in leads)


def test_create_and_fetch_company(client, admin_token):
    payload = {
        "name": "Global Tech Services",
        "industry": "Technology",
        "website": "globaltech.io",
        "employee_count": 120,
    }
    res = client.post(
        "/api/v1/companies/",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    comp = res.json()
    assert comp["name"] == "Global Tech Services"

    # List companies
    list_res = client.get(
        "/api/v1/companies/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1


def test_outreach_stats_endpoint(client, admin_token):
    res = client.get(
        "/api/v1/outreach/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    stats = res.json()
    assert "total_prospects" in stats
    assert "hot" in stats
    assert "warm" in stats
    assert "cold" in stats
