from src import main


def test_create_app_in_production(monkeypatch):
    # Regression: a prod-only FastAPI kwarg crashed startup after a FastAPI upgrade.
    monkeypatch.setattr(main.settings, "ENVIRONMENT", "production")
    assert main.create_app() is not None
