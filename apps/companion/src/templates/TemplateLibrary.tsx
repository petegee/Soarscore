import { useCallback, useEffect, useState } from "react";
import type { Competition, ContestTemplate } from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import { TemplateForm, type TemplateSubmitValues } from "./TemplateForm.js";

interface EditState {
  template?: ContestTemplate;
}

// Identity supplied when seeding a competition from a template — configuration
// comes from the template (copy-on-seed, RD4).
interface SeedState {
  template: ContestTemplate;
  name: string;
  date: string;
  venue: string;
}

export function TemplateLibrary({ actor }: { actor: Actor }) {
  const [templates, setTemplates] = useState<ContestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [pendingDelete, setPendingDelete] = useState<ContestTemplate | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [seedState, setSeedState] = useState<SeedState | null>(null);
  const [seedErrors, setSeedErrors] = useState<Record<string, string[]> | undefined>();
  const [seededName, setSeededName] = useState<string | null>(null);

  const actorName = actor.actorName ?? "unknown";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<ContestTemplate[]>("/api/templates", {
        actorName,
        clientId: actor.clientId,
      });
      setTemplates(result);
    } finally {
      setLoading(false);
    }
  }, [actorName, actor.clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(values: TemplateSubmitValues) {
    setFieldErrors(undefined);
    try {
      if (editState?.template) {
        await apiRequest(`/api/templates/${editState.template.id}`, {
          method: "PUT",
          body: values,
          actorName,
          clientId: actor.clientId,
        });
      } else {
        await apiRequest("/api/templates", {
          method: "POST",
          body: values,
          actorName,
          clientId: actor.clientId,
        });
      }
      setEditState(null);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.response.details as { fieldErrors?: Record<string, string[]> } | undefined;
        setFieldErrors(details?.fieldErrors ?? { name: [error.response.message] });
      } else {
        throw error;
      }
    }
  }

  async function confirmDelete(template: ContestTemplate) {
    setDeleteError(null);
    try {
      await apiRequest(`/api/templates/${template.id}`, {
        method: "DELETE",
        actorName,
        clientId: actor.clientId,
      });
      setPendingDelete(null);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setDeleteError(error.response.message);
      } else {
        throw error;
      }
    }
  }

  function startSeed(template: ContestTemplate) {
    setSeedState({ template, name: "", date: "", venue: "" });
    setSeedErrors(undefined);
    setSeededName(null);
  }

  async function confirmSeed(seed: SeedState) {
    setSeedErrors(undefined);
    try {
      const competition = await apiRequest<Competition>(
        `/api/templates/${seed.template.id}/seed`,
        {
          method: "POST",
          body: { name: seed.name, date: seed.date, venue: seed.venue },
          actorName,
          clientId: actor.clientId,
        },
      );
      setSeedState(null);
      setSeededName(competition.name);
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.response.details as { fieldErrors?: Record<string, string[]> } | undefined;
        setSeedErrors(details?.fieldErrors ?? { name: [error.response.message] });
      } else {
        throw error;
      }
    }
  }

  if (editState) {
    return (
      <TemplateForm
        template={editState.template}
        fieldErrors={fieldErrors}
        onSubmit={handleSubmit}
        onCancel={() => {
          setEditState(null);
          setFieldErrors(undefined);
        }}
      />
    );
  }

  return (
    <div>
      <h1>Contest templates</h1>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setEditState({})}>
          Add template
        </button>
      </div>

      {seededName && (
        <p role="status" className="status-text">
          Competition "{seededName}" created — find it under Competitions.
        </p>
      )}

      {loading && <p className="status-text">Loading…</p>}
      {!loading && templates.length === 0 && (
        <p className="status-text">No templates yet. Add one to get started.</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Discipline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{template.discipline}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-small" onClick={() => startSeed(template)}>
                        New competition
                      </button>
                      <button className="btn btn-small" onClick={() => setEditState({ template })}>
                        Edit
                      </button>
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => setPendingDelete(template)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seedState && (
        <div className="dialog-backdrop">
          <div role="dialog" className="dialog">
            <p>New competition from {seedState.template.name}</p>

            <label htmlFor="seed-name">Name (required)</label>
            <input
              id="seed-name"
              value={seedState.name}
              onChange={(event) =>
                setSeedState((current) => current && { ...current, name: event.target.value })
              }
              required
            />
            {seedErrors?.name && (
              <p role="alert" className="field-error">
                {seedErrors.name.join(", ")}
              </p>
            )}

            <label htmlFor="seed-date">Date (required)</label>
            <input
              id="seed-date"
              type="date"
              value={seedState.date}
              onChange={(event) =>
                setSeedState((current) => current && { ...current, date: event.target.value })
              }
              required
            />
            {seedErrors?.date && (
              <p role="alert" className="field-error">
                {seedErrors.date.join(", ")}
              </p>
            )}

            <label htmlFor="seed-venue">Venue</label>
            <input
              id="seed-venue"
              value={seedState.venue}
              onChange={(event) =>
                setSeedState((current) => current && { ...current, venue: event.target.value })
              }
            />
            {seedErrors?.venue && (
              <p role="alert" className="field-error">
                {seedErrors.venue.join(", ")}
              </p>
            )}

            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  confirmSeed(seedState);
                }}
              >
                Create competition
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSeedState(null);
                  setSeedErrors(undefined);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="dialog-backdrop">
          <div role="dialog" className="dialog">
            <p>Delete {pendingDelete.name}?</p>
            {deleteError && (
              <p role="alert" className="field-error">
                {deleteError}
              </p>
            )}
            <div className="form-actions">
              <button
                className="btn btn-danger"
                onClick={() => {
                  confirmDelete(pendingDelete);
                }}
              >
                Confirm delete
              </button>
              <button
                className="btn"
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
