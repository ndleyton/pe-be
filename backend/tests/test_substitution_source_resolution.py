from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.exercises import substitution_service as module


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "names,requested,expected_error",
    [
        ([(1, "Bench Press")], "  BENCH---press  ", None),
        ([(1, "Bench Press"), (2, "Bench-Press")], "bench press", "Ambiguous"),
        ([(1, "Bench Press")], "bench", "No exact.*Candidates: Bench Press \\(ID 1\\)"),
        ([], "unknown", "No exact.*search_exercises"),
        ([], "---", "Exercise name is required"),
    ],
)
async def test_name_resolution(monkeypatch, names, requested, expected_error):
    session = AsyncMock()
    rows = MagicMock()
    rows.all.return_value = names
    session.execute.return_value = rows
    source = SimpleNamespace(id=1, name="Bench Press")
    get_by_id = AsyncMock(return_value=source)
    search = AsyncMock(
        return_value=SimpleNamespace(
            data=[SimpleNamespace(id=i, name=n) for i, n in names]
        )
    )
    monkeypatch.setattr(module, "get_exercise_type_by_id", get_by_id)
    monkeypatch.setattr(module, "get_exercise_types", search)
    service = module.ExerciseSubstitutionService()
    service.recommend_from_source = AsyncMock(return_value="result")

    if expected_error:
        with pytest.raises(LookupError, match=expected_error):
            await service.recommend_substitutions(
                session, exercise_name=requested, released_only=True
            )
        get_by_id.assert_not_awaited()
        service.recommend_from_source.assert_not_awaited()
    else:
        assert (
            await service.recommend_substitutions(
                session, exercise_name=requested, released_only=True
            )
            == "result"
        )
        get_by_id.assert_awaited_once_with(session, 1, user_id=None, released_only=True)
        search.assert_not_awaited()


@pytest.mark.asyncio
async def test_id_lookup_does_not_search_names(monkeypatch):
    session = AsyncMock()
    source = SimpleNamespace(id=12)
    get_by_id = AsyncMock(return_value=source)
    monkeypatch.setattr(module, "get_exercise_type_by_id", get_by_id)
    service = module.ExerciseSubstitutionService()
    service.recommend_from_source = AsyncMock(return_value="result")
    assert (
        await service.recommend_substitutions(session, exercise_type_id=12, user_id=4)
        == "result"
    )
    get_by_id.assert_awaited_once_with(session, 12, user_id=4, released_only=False)
    session.execute.assert_not_awaited()
