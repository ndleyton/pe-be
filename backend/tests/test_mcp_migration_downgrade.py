import importlib.util
from unittest.mock import MagicMock, patch

# Dynamically load the migration module
spec = importlib.util.spec_from_file_location(
    "migration_20260902_0001",
    "alembic/versions/20260902_0001_add_mcp_pat_and_idempotency.py",
)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


def test_enum_referenced_by_columns_without_table_name():
    mock_conn = MagicMock()
    mock_conn.scalar.return_value = True

    result = migration._enum_referenced_by_columns(
        mock_conn, "mcp_idempotency_status"
    )

    assert result is True
    mock_conn.scalar.assert_called_once()
    called_sql, called_params = mock_conn.scalar.call_args[0]
    sql_str = str(called_sql)
    assert "information_schema.columns" in sql_str
    assert "table_schema = current_schema()" in sql_str
    assert "table_name" not in sql_str
    assert called_params == {"enum_name": "mcp_idempotency_status"}


def test_enum_referenced_by_columns_with_table_name():
    mock_conn = MagicMock()
    mock_conn.scalar.return_value = False

    result = migration._enum_referenced_by_columns(
        mock_conn, "mcp_idempotency_status", table_name="mcp_idempotency_records"
    )

    assert result is False
    mock_conn.scalar.assert_called_once()
    called_sql, called_params = mock_conn.scalar.call_args[0]
    sql_str = str(called_sql)
    assert "table_name = :table_name" in sql_str
    assert called_params == {
        "enum_name": "mcp_idempotency_status",
        "table_name": "mcp_idempotency_records",
    }


def test_downgrade_drops_enum_when_table_dropped_and_no_references():
    mock_conn = MagicMock()
    mock_inspector = MagicMock()
    mock_inspector.get_table_names.side_effect = [
        ["mcp_idempotency_records", "personal_access_tokens", "users"],
        ["personal_access_tokens", "users"],
        ["personal_access_tokens", "users"],
        ["users"],
    ]
    mock_inspector.get_table_comment.return_value = {
        "text": migration._OWNERSHIP_MARKER
    }
    mock_inspector.get_columns.return_value = [
        {"name": "timezone", "comment": migration._OWNERSHIP_MARKER}
    ]

    with (
        patch.object(migration.op, "get_bind", return_value=mock_conn),
        patch.object(migration.sa, "inspect", return_value=mock_inspector),
        patch.object(migration.op, "drop_table") as mock_drop_table,
        patch.object(migration.op, "drop_column"),
        patch.object(migration, "_enum_exists", return_value=True),
        patch.object(
            migration,
            "_enum_comment",
            return_value=migration._OWNERSHIP_MARKER,
        ),
        patch.object(
            migration, "_enum_referenced_by_columns", return_value=False
        ),
        patch.object(migration.postgresql, "ENUM") as mock_enum_cls,
    ):
        mock_enum_instance = MagicMock()
        mock_enum_cls.return_value = mock_enum_instance

        migration.downgrade()

        mock_drop_table.assert_any_call("mcp_idempotency_records")
        mock_enum_cls.assert_called_with(name="mcp_idempotency_status")
        mock_enum_instance.drop.assert_called_once_with(
            mock_conn, checkfirst=False
        )


def test_downgrade_preserves_enum_when_records_table_preserved_and_depends_on_enum(
    caplog,
):
    mock_conn = MagicMock()
    mock_inspector = MagicMock()
    mock_inspector.get_table_names.return_value = [
        "mcp_idempotency_records",
        "personal_access_tokens",
        "users",
    ]
    mock_inspector.get_table_comment.side_effect = [
        {"text": "custom_external_marker"},  # mcp_idempotency_records comment
        {"text": migration._OWNERSHIP_MARKER},  # personal_access_tokens comment
    ]
    mock_inspector.get_columns.return_value = [
        {"name": "timezone", "comment": migration._OWNERSHIP_MARKER}
    ]

    with (
        patch.object(migration.op, "get_bind", return_value=mock_conn),
        patch.object(migration.sa, "inspect", return_value=mock_inspector),
        patch.object(migration.op, "drop_table") as mock_drop_table,
        patch.object(migration.op, "drop_column"),
        patch.object(migration, "_enum_exists", return_value=True),
        patch.object(
            migration,
            "_enum_comment",
            return_value=migration._OWNERSHIP_MARKER,
        ),
        patch.object(
            migration,
            "_enum_referenced_by_columns",
            side_effect=lambda conn, enum_name, table_name=None: True
            if table_name == "mcp_idempotency_records"
            else True,
        ),
        patch.object(migration.postgresql, "ENUM") as mock_enum_cls,
    ):
        mock_enum_instance = MagicMock()
        mock_enum_cls.return_value = mock_enum_instance

        with caplog.at_level("WARNING"):
            migration.downgrade()

        dropped_tables = [
            call[0][0] for call in mock_drop_table.call_args_list
        ]
        assert "mcp_idempotency_records" not in dropped_tables
        mock_enum_instance.drop.assert_not_called()
        assert (
            "preserved mcp_idempotency_records table still depends on it"
            in caplog.text
        )


def test_downgrade_preserves_enum_when_another_table_references_it(caplog):
    mock_conn = MagicMock()
    mock_inspector = MagicMock()
    mock_inspector.get_table_names.side_effect = [
        ["mcp_idempotency_records", "other_table"],
        ["other_table"],
        ["other_table"],
        ["other_table"],
    ]
    mock_inspector.get_table_comment.return_value = {
        "text": migration._OWNERSHIP_MARKER
    }
    mock_inspector.get_columns.return_value = []

    with (
        patch.object(migration.op, "get_bind", return_value=mock_conn),
        patch.object(migration.sa, "inspect", return_value=mock_inspector),
        patch.object(migration.op, "drop_table"),
        patch.object(migration, "_enum_exists", return_value=True),
        patch.object(
            migration,
            "_enum_comment",
            return_value=migration._OWNERSHIP_MARKER,
        ),
        patch.object(
            migration,
            "_enum_referenced_by_columns",
            side_effect=lambda conn, enum_name, table_name=None: False
            if table_name == "mcp_idempotency_records"
            else True,
        ),
        patch.object(migration.postgresql, "ENUM") as mock_enum_cls,
    ):
        mock_enum_instance = MagicMock()
        mock_enum_cls.return_value = mock_enum_instance

        with caplog.at_level("WARNING"):
            migration.downgrade()

        mock_enum_instance.drop.assert_not_called()
        assert (
            "still referenced by preserved tables or columns" in caplog.text
        )


def test_downgrade_skips_enum_drop_when_marker_mismatches(caplog):
    mock_conn = MagicMock()
    mock_inspector = MagicMock()
    mock_inspector.get_table_names.return_value = []

    with (
        patch.object(migration.op, "get_bind", return_value=mock_conn),
        patch.object(migration.sa, "inspect", return_value=mock_inspector),
        patch.object(migration, "_enum_exists", return_value=True),
        patch.object(
            migration,
            "_enum_comment",
            return_value="different_ownership_marker",
        ),
        patch.object(migration.postgresql, "ENUM") as mock_enum_cls,
    ):
        mock_enum_instance = MagicMock()
        mock_enum_cls.return_value = mock_enum_instance

        with caplog.at_level("WARNING"):
            migration.downgrade()

        mock_enum_instance.drop.assert_not_called()
        assert (
            "Skipping removal of enum mcp_idempotency_status because it is not marked"
            in caplog.text
        )
