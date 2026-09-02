from fastapi.testclient import TestClient

from src.main import app


MCP_HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}


def _request(client: TestClient, method: str, request_id: int = 1):
    return client.post(
        "/api/mcp/catalog/",
        headers=MCP_HEADERS,
        json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": {}},
    )


def test_catalog_protocol_discovery_and_public_schema():
    with TestClient(app) as client:
        response = client.post(
            "/api/mcp/catalog/",
            headers=MCP_HEADERS,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "pytest", "version": "1"},
                },
            },
        )
        assert response.status_code == 200
        assert response.json()["result"]["serverInfo"]["name"] == "pe-be-catalog"

        response = _request(client, "tools/list", request_id=2)
        assert response.status_code == 200
        tools = {item["name"]: item for item in response.json()["result"]["tools"]}
        assert set(tools) == {
            "search_exercises",
            "get_exercise_details",
            "recommend_exercise_substitutions",
            "list_muscle_groups",
        }
        serialized_schema = str(tools["get_exercise_details"]["outputSchema"])
        for private_field in ("owner_id", "reviewed_by", "review_notes", "status"):
            assert private_field not in serialized_schema

        response = _request(client, "resources/templates/list", request_id=3)
        templates = response.json()["result"]["resourceTemplates"]
        assert any(item["uriTemplate"] == "exercises://{exercise_id}" for item in templates)


def test_trainer_requires_bearer_pat_and_cors_exposes_session_header():
    with TestClient(app) as client:
        response = client.post(
            "/api/mcp/trainer/",
            headers=MCP_HEADERS,
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
        )
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"

        response = client.post(
            "/api/mcp/catalog/",
            headers={
                **MCP_HEADERS,
                "Origin": "http://localhost:5173",
            },
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {},
            },
        )
        assert response.status_code == 200
        assert (
            response.headers["access-control-expose-headers"].lower()
            == "mcp-session-id"
        )
