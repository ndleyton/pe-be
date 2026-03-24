from src.core import database


def test_get_engine_kwargs_uses_pooling_defaults(monkeypatch):
    monkeypatch.delenv("DATABASE_POOL_PRE_PING", raising=False)
    monkeypatch.delenv("DATABASE_POOL_USE_LIFO", raising=False)
    monkeypatch.delenv("DATABASE_POOL_SIZE", raising=False)
    monkeypatch.delenv("DATABASE_MAX_OVERFLOW", raising=False)
    monkeypatch.delenv("DATABASE_POOL_TIMEOUT", raising=False)
    monkeypatch.delenv("DATABASE_POOL_RECYCLE", raising=False)

    assert database.get_engine_kwargs() == {
        "pool_pre_ping": True,
        "pool_use_lifo": True,
        "pool_size": 5,
        "max_overflow": 10,
        "pool_timeout": 30,
        "pool_recycle": 1800,
    }


def test_get_engine_kwargs_respects_env_overrides(monkeypatch):
    monkeypatch.setenv("DATABASE_POOL_PRE_PING", "false")
    monkeypatch.setenv("DATABASE_POOL_USE_LIFO", "0")
    monkeypatch.setenv("DATABASE_POOL_SIZE", "7")
    monkeypatch.setenv("DATABASE_MAX_OVERFLOW", "11")
    monkeypatch.setenv("DATABASE_POOL_TIMEOUT", "22")
    monkeypatch.setenv("DATABASE_POOL_RECYCLE", "333")

    assert database.get_engine_kwargs() == {
        "pool_pre_ping": False,
        "pool_use_lifo": False,
        "pool_size": 7,
        "max_overflow": 11,
        "pool_timeout": 22,
        "pool_recycle": 333,
    }
