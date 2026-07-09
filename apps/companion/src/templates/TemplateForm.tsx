import { useState, type FormEvent } from "react";
import { DISCIPLINES, type ContestTemplate, type Discipline } from "@soarscore/shared";

export interface TemplateFormValues {
  name: string;
  discipline: Discipline | "";
  pilotNumbersEnabled: boolean;
  pilotClassesEnabled: boolean;
  pilotClasses: string[];
}

// Payload sent to the base on save (POST create / PUT edit). Configuration
// only — a template never carries date/venue (RD4); pilotClasses is discarded
// server-side when the toggle is off.
export interface TemplateSubmitValues {
  name: string;
  discipline: Discipline | "";
  pilotNumbersEnabled: boolean;
  pilotClassesEnabled: boolean;
  pilotClasses: string[];
}

function templateToFormValues(template?: ContestTemplate): TemplateFormValues {
  if (!template) {
    return {
      name: "",
      discipline: "",
      pilotNumbersEnabled: false,
      pilotClassesEnabled: false,
      pilotClasses: [],
    };
  }
  return {
    name: template.name,
    discipline: template.discipline,
    pilotNumbersEnabled: template.pilotNumbersEnabled,
    pilotClassesEnabled: template.pilotClassesEnabled,
    pilotClasses: template.pilotClasses,
  };
}

export interface TemplateFormProps {
  template?: ContestTemplate;
  fieldErrors?: Record<string, string[]>;
  onSubmit: (values: TemplateSubmitValues) => void;
  onCancel: () => void;
}

export function TemplateForm({ template, fieldErrors, onSubmit, onCancel }: TemplateFormProps) {
  const [values, setValues] = useState<TemplateFormValues>(() => templateToFormValues(template));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      name: values.name,
      discipline: values.discipline,
      pilotNumbersEnabled: values.pilotNumbersEnabled,
      pilotClassesEnabled: values.pilotClassesEnabled,
      // Drop blanks here too; the base is authoritative on dedupe/discard.
      pilotClasses: values.pilotClasses.map((name) => name.trim()).filter((name) => name.length > 0),
    });
  }

  function update<K extends keyof TemplateFormValues>(key: K, value: TemplateFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  // Toggling pilot classes off clears the local list so a re-enable starts fresh
  // and never resubmits a stale set.
  function togglePilotClasses(enabled: boolean) {
    setValues((current) => ({
      ...current,
      pilotClassesEnabled: enabled,
      pilotClasses: enabled ? current.pilotClasses : [],
    }));
  }

  function updatePilotClass(index: number, value: string) {
    setValues((current) => {
      const pilotClasses = [...current.pilotClasses];
      pilotClasses[index] = value;
      return { ...current, pilotClasses };
    });
  }

  function addPilotClass() {
    setValues((current) => ({ ...current, pilotClasses: [...current.pilotClasses, ""] }));
  }

  function removePilotClass(index: number) {
    setValues((current) => ({
      ...current,
      pilotClasses: current.pilotClasses.filter((_, i) => i !== index),
    }));
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <h1>{template ? "Edit template" : "Add template"}</h1>

      <label htmlFor="template-name">Name (required)</label>
      <input
        id="template-name"
        value={values.name}
        onChange={(event) => update("name", event.target.value)}
        required
      />
      {fieldErrors?.name && (
        <p role="alert" className="field-error">
          {fieldErrors.name.join(", ")}
        </p>
      )}

      <label htmlFor="template-discipline">Discipline (required)</label>
      <select
        id="template-discipline"
        value={values.discipline}
        onChange={(event) => update("discipline", event.target.value as Discipline | "")}
        required
      >
        <option value="" disabled>
          Select a discipline…
        </option>
        {DISCIPLINES.map((discipline) => (
          <option key={discipline} value={discipline}>
            {discipline}
          </option>
        ))}
      </select>
      {fieldErrors?.discipline && (
        <p role="alert" className="field-error">
          {fieldErrors.discipline.join(", ")}
        </p>
      )}

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={values.pilotNumbersEnabled}
          onChange={(event) => update("pilotNumbersEnabled", event.target.checked)}
        />
        Use pilot numbers
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={values.pilotClassesEnabled}
          onChange={(event) => togglePilotClasses(event.target.checked)}
        />
        Use pilot classes
      </label>

      {values.pilotClassesEnabled && (
        <div className="pilot-classes-editor">
          <span className="field-label">Pilot classes</span>
          {values.pilotClasses.map((name, index) => (
            <div key={index} className="pilot-class-row">
              <input
                aria-label={`Pilot class ${index + 1}`}
                value={name}
                onChange={(event) => updatePilotClass(index, event.target.value)}
              />
              <button
                type="button"
                className="btn btn-small"
                onClick={() => removePilotClass(index)}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-small" onClick={addPilotClass}>
            Add pilot class
          </button>
          {fieldErrors?.pilotClasses && (
            <p role="alert" className="field-error">
              {fieldErrors.pilotClasses.join(", ")}
            </p>
          )}
        </div>
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
