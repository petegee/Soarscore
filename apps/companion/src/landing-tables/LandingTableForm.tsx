import { useState, type FormEvent } from "react";
import type { LandingBonusTable } from "@soarscore/shared";

interface EntryFormValues {
  distanceM: string;
  points: string;
}

export interface LandingTableFormValues {
  name: string;
  entries: EntryFormValues[];
}

function tableToFormValues(table?: LandingBonusTable): LandingTableFormValues {
  if (!table) {
    return { name: "", entries: [{ distanceM: "", points: "" }] };
  }
  return {
    name: table.name,
    entries: table.entries.map((e) => ({
      distanceM: String(e.distanceM),
      points: String(e.points),
    })),
  };
}

export interface LandingTableFormProps {
  table?: LandingBonusTable;
  fieldErrors?: Record<string, string[]>;
  onSubmit: (values: { name: string; entries: { distanceM: number; points: number }[] }) => void;
  onCancel: () => void;
}

export function LandingTableForm({ table, fieldErrors, onSubmit, onCancel }: LandingTableFormProps) {
  const [values, setValues] = useState<LandingTableFormValues>(() => tableToFormValues(table));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      name: values.name,
      entries: values.entries.map((e) => ({
        distanceM: Number(e.distanceM),
        points: Number(e.points),
      })),
    });
  }

  function updateName(value: string) {
    setValues((current) => ({ ...current, name: value }));
  }

  function updateEntry(index: number, key: keyof EntryFormValues, value: string) {
    setValues((current) => ({
      ...current,
      entries: current.entries.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    }));
  }

  function addRow() {
    setValues((current) => ({
      ...current,
      entries: [...current.entries, { distanceM: "", points: "" }],
    }));
  }

  function removeRow(index: number) {
    setValues((current) =>
      // At least one entry is required — never remove the last remaining row.
      current.entries.length <= 1
        ? current
        : { ...current, entries: current.entries.filter((_, i) => i !== index) },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form form-wide">
      <h1>{table ? "Edit landing-bonus table" : "Add landing-bonus table"}</h1>
      <label htmlFor="landing-table-name">Name (required)</label>
      <input
        id="landing-table-name"
        value={values.name}
        onChange={(event) => updateName(event.target.value)}
        required
      />
      {fieldErrors?.name && (
        <p role="alert" className="field-error">
          {fieldErrors.name.join(", ")}
        </p>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Distance (m)</th>
            <th>Points</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {values.entries.map((entry, index) => (
            <tr key={index}>
              <td>
                <input
                  aria-label={`Distance for row ${index + 1}`}
                  value={entry.distanceM}
                  onChange={(event) => updateEntry(index, "distanceM", event.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={`Points for row ${index + 1}`}
                  value={entry.points}
                  onChange={(event) => updateEntry(index, "points", event.target.value)}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => removeRow(index)}
                  disabled={values.entries.length <= 1}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {fieldErrors?.entries && (
        <p role="alert" className="field-error">
          {fieldErrors.entries.join(", ")}
        </p>
      )}

      <div className="toolbar">
        <button type="button" className="btn" onClick={addRow}>
          Add row
        </button>
      </div>

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
