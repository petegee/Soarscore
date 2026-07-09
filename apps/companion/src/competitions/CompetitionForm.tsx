import { useState, type FormEvent } from "react";
import type { Competition } from "@soarscore/shared";

export interface CompetitionFormValues {
  name: string;
  date: string;
  venue: string;
}

function competitionToFormValues(competition?: Competition): CompetitionFormValues {
  if (!competition) {
    return { name: "", date: "", venue: "" };
  }
  return {
    name: competition.name,
    date: competition.date,
    venue: competition.venue ?? "",
  };
}

export interface CompetitionFormProps {
  competition?: Competition;
  fieldErrors?: Record<string, string[]>;
  onSubmit: (values: { name: string; date: string; venue: string }) => void;
  onCancel: () => void;
}

export function CompetitionForm({ competition, fieldErrors, onSubmit, onCancel }: CompetitionFormProps) {
  const [values, setValues] = useState<CompetitionFormValues>(() =>
    competitionToFormValues(competition),
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name: values.name, date: values.date, venue: values.venue });
  }

  function update(key: keyof CompetitionFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <h1>{competition ? "Edit competition" : "Add competition"}</h1>

      <label htmlFor="competition-name">Name (required)</label>
      <input
        id="competition-name"
        value={values.name}
        onChange={(event) => update("name", event.target.value)}
        required
      />
      {fieldErrors?.name && (
        <p role="alert" className="field-error">
          {fieldErrors.name.join(", ")}
        </p>
      )}

      <label htmlFor="competition-date">Date (required)</label>
      <input
        id="competition-date"
        type="date"
        value={values.date}
        onChange={(event) => update("date", event.target.value)}
        required
      />
      {fieldErrors?.date && (
        <p role="alert" className="field-error">
          {fieldErrors.date.join(", ")}
        </p>
      )}

      <label htmlFor="competition-venue">Venue</label>
      <input
        id="competition-venue"
        value={values.venue}
        onChange={(event) => update("venue", event.target.value)}
      />
      {fieldErrors?.venue && (
        <p role="alert" className="field-error">
          {fieldErrors.venue.join(", ")}
        </p>
      )}

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
