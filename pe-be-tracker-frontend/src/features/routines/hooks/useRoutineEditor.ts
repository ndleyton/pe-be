import { useEffect, useMemo, useReducer } from "react";

import type {
  ExerciseType,
  IntensityUnit,
} from "@/features/exercises/api";
import type { Routine, RoutineVisibility } from "@/features/routines/types";
import type { GuestExerciseType, GuestIntensityUnit } from "@/stores";
import {
  buildComparableSnapshot,
  buildEditorTemplatesFromRoutine,
  createDefaultSet,
  toRoutineExerciseTypeOption,
  toRoutineIntensityUnitOption,
  type ExercisePickerTarget,
  type RoutineEditorSet,
  type RoutineEditorTemplate,
  type RoutineIntensityUnitOption,
  type UnitPickerTarget,
} from "@/features/routines/lib/routineEditor";

type RoutineEditorState = {
  name: string;
  description: string;
  visibility: RoutineVisibility;
  editorTemplates: RoutineEditorTemplate[];
  initialSnapshot: string;
  exercisePickerTarget: ExercisePickerTarget | null;
  unitPickerTarget: UnitPickerTarget | null;
};

type InitializeAction = {
  type: "initialize";
  payload: {
    routine: Routine;
    availableIntensityUnits: RoutineIntensityUnitOption[];
  };
};

type RoutineEditorAction =
  | InitializeAction
  | { type: "setName"; payload: string }
  | { type: "setDescription"; payload: string }
  | { type: "setVisibility"; payload: RoutineVisibility }
  | { type: "openExercisePicker"; payload: ExercisePickerTarget }
  | { type: "closeExercisePicker" }
  | { type: "openUnitPicker"; payload: UnitPickerTarget }
  | { type: "closeUnitPicker" }
  | {
      type: "applyExerciseTypeSelection";
      payload: {
        selectedExerciseType: ExerciseType | GuestExerciseType;
        availableIntensityUnits: RoutineIntensityUnitOption[];
      };
    }
  | {
      type: "applyIntensityUnitSelection";
      payload: IntensityUnit | GuestIntensityUnit;
    }
  | {
      type: "updateSet";
      payload: {
        templateId: string;
        setId: string;
        updates: Partial<RoutineEditorSet>;
      };
    }
  | {
      type: "addSetToTemplate";
      payload: {
        templateId: string;
        availableIntensityUnits: RoutineIntensityUnitOption[];
      };
    }
  | {
      type: "removeSetFromTemplate";
      payload: {
        templateId: string;
        setId: string;
      };
    }
  | { type: "removeTemplate"; payload: { templateId: string } };

const initialState: RoutineEditorState = {
  name: "",
  description: "",
  visibility: "private",
  editorTemplates: [],
  initialSnapshot: "",
  exercisePickerTarget: null,
  unitPickerTarget: null,
};

const routineEditorReducer = (
  state: RoutineEditorState,
  action: RoutineEditorAction,
): RoutineEditorState => {
  switch (action.type) {
    case "initialize": {
      const nextName = action.payload.routine.name;
      const nextDescription = action.payload.routine.description ?? "";
      const nextVisibility = action.payload.routine.visibility;
      const nextTemplates = buildEditorTemplatesFromRoutine(
        action.payload.routine,
        action.payload.availableIntensityUnits,
      );

      return {
        ...state,
        name: nextName,
        description: nextDescription,
        visibility: nextVisibility,
        editorTemplates: nextTemplates,
        initialSnapshot: buildComparableSnapshot(
          nextName,
          nextDescription,
          nextVisibility,
          nextTemplates,
        ),
      };
    }
    case "setName":
      return {
        ...state,
        name: action.payload,
      };
    case "setDescription":
      return {
        ...state,
        description: action.payload,
      };
    case "setVisibility":
      return {
        ...state,
        visibility: action.payload,
      };
    case "openExercisePicker":
      return {
        ...state,
        exercisePickerTarget: action.payload,
      };
    case "closeExercisePicker":
      return {
        ...state,
        exercisePickerTarget: null,
      };
    case "openUnitPicker":
      return {
        ...state,
        unitPickerTarget: action.payload,
      };
    case "closeUnitPicker":
      return {
        ...state,
        unitPickerTarget: null,
      };
    case "applyExerciseTypeSelection": {
      const nextExerciseType = toRoutineExerciseTypeOption(
        action.payload.selectedExerciseType,
      );
      const defaultUnitId = nextExerciseType?.default_intensity_unit;

      if (!state.exercisePickerTarget || !nextExerciseType) {
        return state;
      }

      if (state.exercisePickerTarget.mode === "add") {
        return {
          ...state,
          editorTemplates: [
            ...state.editorTemplates,
            {
              id: `temp-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
              exercise_type_id: Number(nextExerciseType.id),
              exercise_type: nextExerciseType,
              set_templates: [
                createDefaultSet(
                  action.payload.availableIntensityUnits,
                  defaultUnitId,
                ),
              ],
            },
          ],
          exercisePickerTarget: null,
        };
      }

      const targetTemplateId = state.exercisePickerTarget.templateId;

      return {
        ...state,
        editorTemplates: state.editorTemplates.map((template) =>
          template.id === targetTemplateId
            ? {
                ...template,
                exercise_type_id: Number(nextExerciseType.id),
                exercise_type: nextExerciseType,
                set_templates:
                  template.set_templates.length > 0
                    ? template.set_templates
                    : [
                        createDefaultSet(
                          action.payload.availableIntensityUnits,
                          defaultUnitId,
                        ),
                      ],
              }
            : template,
        ),
        exercisePickerTarget: null,
      };
    }
    case "applyIntensityUnitSelection": {
      if (!state.unitPickerTarget) {
        return state;
      }

      const nextUnit = toRoutineIntensityUnitOption(action.payload);
      if (!nextUnit) {
        return state;
      }

      return {
        ...state,
        editorTemplates: state.editorTemplates.map((template) =>
          template.id !== state.unitPickerTarget?.templateId
            ? template
            : {
                ...template,
                set_templates: template.set_templates.map((setTemplate) =>
                  setTemplate.id !== state.unitPickerTarget?.setId
                    ? setTemplate
                    : {
                        ...setTemplate,
                        intensity_unit_id: nextUnit.id,
                        intensity_unit: nextUnit,
                      },
                ),
              },
        ),
        unitPickerTarget: null,
      };
    }
    case "updateSet":
      return {
        ...state,
        editorTemplates: state.editorTemplates.map((template) =>
          template.id !== action.payload.templateId
            ? template
            : {
                ...template,
                set_templates: template.set_templates.map((setTemplate) =>
                  setTemplate.id === action.payload.setId
                    ? {
                        ...setTemplate,
                        ...action.payload.updates,
                      }
                    : setTemplate,
                ),
              },
        ),
      };
    case "addSetToTemplate":
      return {
        ...state,
        editorTemplates: state.editorTemplates.map((template) =>
          template.id !== action.payload.templateId
            ? template
            : {
                ...template,
                set_templates: [
                  ...template.set_templates,
                  createDefaultSet(
                    action.payload.availableIntensityUnits,
                    template.exercise_type?.default_intensity_unit,
                  ),
                ],
              },
        ),
      };
    case "removeSetFromTemplate":
      return {
        ...state,
        editorTemplates: state.editorTemplates.map((template) =>
          template.id !== action.payload.templateId
            ? template
            : {
                ...template,
                set_templates: template.set_templates.filter(
                  (setTemplate) => setTemplate.id !== action.payload.setId,
                ),
              },
        ),
      };
    case "removeTemplate":
      return {
        ...state,
        editorTemplates: state.editorTemplates.filter(
          (template) => template.id !== action.payload.templateId,
        ),
      };
    default:
      return state;
  }
};

export const useRoutineEditor = ({
  availableIntensityUnits,
  routine,
}: {
  availableIntensityUnits: RoutineIntensityUnitOption[];
  routine: Routine | null;
}) => {
  const [state, dispatch] = useReducer(routineEditorReducer, initialState);

  useEffect(() => {
    if (!routine) {
      return;
    }

    dispatch({
      type: "initialize",
      payload: {
        routine,
        availableIntensityUnits,
      },
    });
  }, [availableIntensityUnits, routine]);

  const comparableSnapshot = useMemo(
    () =>
      buildComparableSnapshot(
        state.name,
        state.description,
        state.visibility,
        state.editorTemplates,
      ),
    [state.description, state.editorTemplates, state.name, state.visibility],
  );

  const hasUnsavedChanges =
    state.initialSnapshot.length > 0 &&
    comparableSnapshot !== state.initialSnapshot;

  const hasInvalidTemplates =
    !state.name.trim() ||
    state.editorTemplates.some(
      (template) =>
        template.exercise_type_id == null ||
        template.set_templates.some(
          (setTemplate) => !setTemplate.intensity_unit_id,
        ),
    );

  return {
    description: state.description,
    editorTemplates: state.editorTemplates,
    exercisePickerTarget: state.exercisePickerTarget,
    hasInvalidTemplates,
    hasUnsavedChanges,
    name: state.name,
    visibility: state.visibility,
    unitPickerTarget: state.unitPickerTarget,
    addSetToTemplate: (templateId: string) =>
      dispatch({
        type: "addSetToTemplate",
        payload: { templateId, availableIntensityUnits },
      }),
    closeExercisePicker: () => dispatch({ type: "closeExercisePicker" }),
    closeUnitPicker: () => dispatch({ type: "closeUnitPicker" }),
    handleExerciseTypeSelected: (
      selectedExerciseType: ExerciseType | GuestExerciseType,
    ) =>
      dispatch({
        type: "applyExerciseTypeSelection",
        payload: { selectedExerciseType, availableIntensityUnits },
      }),
    handleIntensityUnitSelected: (
      selectedUnit: IntensityUnit | GuestIntensityUnit,
    ) =>
      dispatch({
        type: "applyIntensityUnitSelection",
        payload: selectedUnit,
      }),
    openExercisePicker: (target: ExercisePickerTarget) =>
      dispatch({ type: "openExercisePicker", payload: target }),
    openUnitPicker: (target: UnitPickerTarget) =>
      dispatch({ type: "openUnitPicker", payload: target }),
    removeSetFromTemplate: (templateId: string, setId: string) =>
      dispatch({
        type: "removeSetFromTemplate",
        payload: { setId, templateId },
      }),
    removeTemplate: (templateId: string) =>
      dispatch({
        type: "removeTemplate",
        payload: { templateId },
      }),
    setDescription: (value: string) =>
      dispatch({ type: "setDescription", payload: value }),
    setVisibility: (value: RoutineVisibility) =>
      dispatch({ type: "setVisibility", payload: value }),
    setName: (value: string) =>
      dispatch({ type: "setName", payload: value }),
    updateSet: (
      templateId: string,
      setId: string,
      updates: Partial<RoutineEditorSet>,
    ) =>
      dispatch({
        type: "updateSet",
        payload: { setId, templateId, updates },
      }),
  };
};
