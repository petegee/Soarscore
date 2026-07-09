import { useState, type FormEvent } from "react";
import type { Pilot } from "@soarscore/shared";

export interface PilotFormValues {
  name: string;
  registrationId: string;
  club: string;
  contact: string;
}

function pilotToFormValues(pilot?: Pilot): PilotFormValues {
  return {
    name: pilot?.name ?? "",
    registrationId: pilot?.registrationId ?? "",
    club: pilot?.club ?? "",
    contact: pilot?.contact ?? "",
  };
}

export interface PilotFormProps {
  pilot?: Pilot;
  fieldErrors?: Record<string, string[]>;
  onSubmit: (values: PilotFormValues) => void;
  onCancel: () => void;
}

export function PilotForm({ pilot, fieldErrors, onSubmit, onCancel }: PilotFormProps) {
  const [values, setValues] = useState<PilotFormValues>(() => pilotToFormValues(pilot));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  function update<K extends keyof PilotFormValues>(key: K, value: PilotFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <h1>{pilot ? "Edit pilot" : "Add pilot"}</h1>
      <label htmlFor="pilot-name">Name (required)</label>
      <input
        id="pilot-name"
        value={values.name}
        onChange={(event) => update("name", event.target.value)}
        required
      />
      {fieldErrors?.name && (
        <p role="alert" className="field-error">
          {fieldErrors.name.join(", ")}
        </p>
      )}

      <label htmlFor="pilot-registration">Registration ID</label>
      <input
        id="pilot-registration"
        value={values.registrationId}
        onChange={(event) => update("registrationId", event.target.value)}
      />

      <label htmlFor="pilot-club">Club</label>
      <input
        id="pilot-club"
        value={values.club}
        onChange={(event) => update("club", event.target.value)}
      />

      <label htmlFor="pilot-contact">Contact</label>
      <input
        id="pilot-contact"
        value={values.contact}
        onChange={(event) => update("contact", event.target.value)}
      />

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
