import { useCallback, useEffect, useState } from "react";
import type { CompetitionRef, Pilot } from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import { PilotForm, type PilotFormValues } from "./PilotForm.js";

interface EditState {
  pilot?: Pilot;
}

function formValuesToBody(values: PilotFormValues) {
  return {
    name: values.name,
    registrationId: values.registrationId,
    club: values.club,
    contact: values.contact,
  };
}

export function PilotLibrary({ actor }: { actor: Actor }) {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Pilot | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const actorName = actor.actorName ?? "unknown";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<Pilot[]>("/api/pilots", {
        actorName,
        clientId: actor.clientId,
      });
      setPilots(result);
    } finally {
      setLoading(false);
    }
  }, [actorName, actor.clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(values: PilotFormValues) {
    setFieldErrors(undefined);
    try {
      if (editState?.pilot) {
        await apiRequest(`/api/pilots/${editState.pilot.id}`, {
          method: "PUT",
          body: formValuesToBody(values),
          actorName,
          clientId: actor.clientId,
        });
      } else {
        await apiRequest("/api/pilots", {
          method: "POST",
          body: formValuesToBody(values),
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

  async function confirmDelete(pilot: Pilot) {
    setDeleteError(null);
    try {
      await apiRequest(`/api/pilots/${pilot.id}`, {
        method: "DELETE",
        actorName,
        clientId: actor.clientId,
      });
      setPendingDelete(null);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.response.details as { competitions?: CompetitionRef[] } | undefined;
        const names = details?.competitions?.map((c) => c.name).join(", ");
        setDeleteError(names ? `cannot delete — on the roster of: ${names}` : error.response.message);
      } else {
        throw error;
      }
    }
  }

  if (editState) {
    return (
      <PilotForm
        pilot={editState.pilot}
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
      <h1>Pilot library</h1>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setEditState({})}>
          Add pilot
        </button>
      </div>

      {loading && <p className="status-text">Loading…</p>}
      {!loading && pilots.length === 0 && (
        <p className="status-text">No pilots yet. Add one to get started.</p>
      )}

      {!loading && pilots.length > 0 && (
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Registration ID</th>
              <th>Club</th>
              <th>Contact</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pilots.map((pilot) => (
              <tr key={pilot.id}>
                <td>{pilot.name}</td>
                <td>{pilot.registrationId ?? ""}</td>
                <td>{pilot.club ?? ""}</td>
                <td>{pilot.contact ?? ""}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-small" onClick={() => setEditState({ pilot })}>
                      Edit
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => setPendingDelete(pilot)}
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
