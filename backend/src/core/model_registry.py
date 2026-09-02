import importlib


_MODEL_REGISTRY_LOADED = False


def ensure_model_registry_loaded() -> None:
    """Load every ORM model module needed by standalone entrypoints."""
    global _MODEL_REGISTRY_LOADED
    if _MODEL_REGISTRY_LOADED:
        return

    for module_name in (
        "src.chat.models",
        "src.exercise_sets.models",
        "src.exercises.models",
        "src.mcp.models",
        "src.routine_programs.models",
        "src.routines.models",
        "src.sync.models",
        "src.users.models",
        "src.users.pat_models",
        "src.workouts.models",
    ):
        importlib.import_module(module_name)

    _MODEL_REGISTRY_LOADED = True
