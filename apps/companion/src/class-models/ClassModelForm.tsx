import { useState, type FormEvent } from "react";
import type {
  ClassModelBasis,
  ContestClassModel,
  DropWorstUnit,
  TaskParameterSet,
} from "@soarscore/shared";

// Edits the rule-fixed surface of a CUSTOM model only (AC7). Stock models never
// reach this form — the library disables Edit for them and shows a clone hint.
// STORY-001-008: scoring parameters moved onto tasks[]. Full per-task editing is
// a deferred (per-discipline) task screen; this form exposes only the primary
// task's points-per-second and rides the rest of tasks[] through unchanged.
export interface ClassModelSubmitValues {
  name: string;
  basis: ClassModelBasis;
  speedInverted: boolean;
  dropWorst: { threshold: number; unit: DropWorstUnit };
  tasks: TaskParameterSet[];
}

export interface ClassModelFormProps {
  model: ContestClassModel;
  fieldErrors?: Record<string, string[]>;
  onSubmit: (values: ClassModelSubmitValues) => void;
  onCancel: () => void;
}

export function ClassModelForm({ model, fieldErrors, onSubmit, onCancel }: ClassModelFormProps) {
  const [name, setName] = useState(model.name);
  const [basis, setBasis] = useState<ClassModelBasis>(model.basis);
  const [speedInverted, setSpeedInverted] = useState(model.speedInverted);
  // The primary task's rate. Kept as a string so an empty field maps cleanly to
  // null (task fixes no rate). Other task parameters ride through unchanged.
  const primaryRate = model.tasks[0]?.pointsPerSecond ?? null;
  const [pointsPerSecond, setPointsPerSecond] = useState(
    primaryRate === null ? "" : String(primaryRate),
  );
  const [threshold, setThreshold] = useState(String(model.dropWorst.threshold));
  const [unit, setUnit] = useState<DropWorstUnit>(model.dropWorst.unit);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const rate = pointsPerSecond.trim() === "" ? null : Number(pointsPerSecond);
    // Deep-copy tasks[] and apply the one edited value onto the primary task;
    // every other task parameter (precision, table, penalties, NLH) rides
    // through unchanged — its editor is a deferred per-discipline task screen.
    const tasks: TaskParameterSet[] = model.tasks.map((task, index) => ({
      ...task,
      timingPrecision: { ...task.timingPrecision },
      landingTable: task.landingTable
        ? { ...task.landingTable, entries: task.landingTable.entries.map((e) => ({ ...e })) }
        : null,
      nlhCoefficients: task.nlhCoefficients ? { ...task.nlhCoefficients } : null,
      penaltyTypes: task.penaltyTypes.map((p) => ({ ...p })),
      pointsPerSecond: index === 0 ? rate : task.pointsPerSecond,
    }));
    onSubmit({
      name,
      basis,
      speedInverted,
      dropWorst: { threshold: Number(threshold), unit },
      tasks,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <h1>Edit {model.name}</h1>

      <label htmlFor="class-model-name">Name (required)</label>
      <input
        id="class-model-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      {fieldErrors?.name && (
        <p role="alert" className="field-error">
          {fieldErrors.name.join(", ")}
        </p>
      )}

      <label htmlFor="class-model-basis">Scoring basis</label>
      <select
        id="class-model-basis"
        value={basis}
        onChange={(event) => setBasis(event.target.value as ClassModelBasis)}
      >
        <option value="single-group">Single group score</option>
        <option value="separate-per-task">Separate per task</option>
      </select>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={speedInverted}
          onChange={(event) => setSpeedInverted(event.target.checked)}
        />
        Speed task (inverted ratio)
      </label>

      <label htmlFor="class-model-pps">Points per second (blank if none)</label>
      <input
        id="class-model-pps"
        type="number"
        min="0"
        step="any"
        value={pointsPerSecond}
        onChange={(event) => setPointsPerSecond(event.target.value)}
      />
      {fieldErrors?.pointsPerSecond && (
        <p role="alert" className="field-error">
          {fieldErrors.pointsPerSecond.join(", ")}
        </p>
      )}

      <label htmlFor="class-model-threshold">Drop-worst beyond (rounds/tasks)</label>
      <input
        id="class-model-threshold"
        type="number"
        min="0"
        step="1"
        value={threshold}
        onChange={(event) => setThreshold(event.target.value)}
      />
      {fieldErrors?.["dropWorst.threshold"] && (
        <p role="alert" className="field-error">
          {fieldErrors["dropWorst.threshold"].join(", ")}
        </p>
      )}

      <label htmlFor="class-model-unit">Drop-worst unit</label>
      <select
        id="class-model-unit"
        value={unit}
        onChange={(event) => setUnit(event.target.value as DropWorstUnit)}
      >
        <option value="round">Round</option>
        <option value="task">Task</option>
      </select>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Save
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
