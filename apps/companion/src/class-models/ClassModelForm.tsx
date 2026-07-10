import { useState, type FormEvent } from "react";
import type {
  ClassModelBasis,
  ContestClassModel,
  DropWorstUnit,
  LandingBonusEntry,
} from "@soarscore/shared";

// Edits the rule-fixed surface of a CUSTOM model only (AC7). Stock models never
// reach this form — the library disables Edit for them and shows a clone hint.
export interface ClassModelSubmitValues {
  name: string;
  basis: ClassModelBasis;
  speedInverted: boolean;
  pointsPerSecond: number | null;
  dropWorst: { threshold: number; unit: DropWorstUnit };
  landingTable: { id?: string; name: string; entries: LandingBonusEntry[] } | null;
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
  // Kept as strings so an empty field maps cleanly to null (class fixes no rate).
  const [pointsPerSecond, setPointsPerSecond] = useState(
    model.pointsPerSecond === null ? "" : String(model.pointsPerSecond),
  );
  const [threshold, setThreshold] = useState(String(model.dropWorst.threshold));
  const [unit, setUnit] = useState<DropWorstUnit>(model.dropWorst.unit);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      name,
      basis,
      speedInverted,
      pointsPerSecond: pointsPerSecond.trim() === "" ? null : Number(pointsPerSecond),
      dropWorst: { threshold: Number(threshold), unit },
      // The landing table rides through unchanged — its editor is deferred to a
      // later story; the owned table is preserved as-is on save.
      landingTable: model.landingTable
        ? {
            id: model.landingTable.id,
            name: model.landingTable.name,
            entries: model.landingTable.entries.map((e) => ({ ...e })),
          }
        : null,
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
