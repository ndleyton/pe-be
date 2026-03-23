from src.core.logging import reset_request_id, set_request_id
from src.core.sentry import FILTERED_VALUE, _before_send, _before_send_transaction


def test_before_send_redacts_sensitive_request_fields_and_user_data():
    token = set_request_id("req-123")

    try:
        event = {
            "request": {
                "headers": {
                    "Authorization": "Bearer secret",
                    "Content-Type": "application/json",
                    "Cookie": "session=secret",
                },
                "cookies": {"session": "secret"},
                "data": {"message": "secret"},
                "query_string": "token=secret",
            },
            "user": {
                "id": "42",
                "email": "user@example.com",
                "ip_address": "127.0.0.1",
            },
        }

        sanitized = _before_send(event, {})

        assert sanitized["tags"]["request_id"] == "req-123"
        assert sanitized["request"]["headers"]["Authorization"] == FILTERED_VALUE
        assert sanitized["request"]["headers"]["Cookie"] == FILTERED_VALUE
        assert sanitized["request"]["headers"]["Content-Type"] == "application/json"
        assert sanitized["request"]["cookies"] == FILTERED_VALUE
        assert sanitized["request"]["data"] == FILTERED_VALUE
        assert sanitized["request"]["query_string"] == FILTERED_VALUE
        assert sanitized["user"]["id"] == "42"
        assert "email" not in sanitized["user"]
        assert "ip_address" not in sanitized["user"]
    finally:
        reset_request_id(token)


def test_before_send_transaction_attaches_request_id():
    token = set_request_id("req-456")

    try:
        event = {"request": {"headers": {"X-Test": "ok"}}}

        sanitized = _before_send_transaction(event, {})

        assert sanitized["tags"]["request_id"] == "req-456"
        assert sanitized["request"]["headers"]["X-Test"] == "ok"
    finally:
        reset_request_id(token)
