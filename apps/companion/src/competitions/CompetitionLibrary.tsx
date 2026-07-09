import { useCallback, useEffect, useState } from "react";
import type { Competition } from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import { CompetitionForm } from "./CompetitionForm.js";

interface EditState {
  competition?: Competition;
}

export function CompetitionLibrary({ actor }: { actor: Actor }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  // "Open" competition is a client-side selection only — the base holds no
  // open-competition session (D8).
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Competition | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Escalated once the base reports captured scores — a stronger, consequence
  // naming confirmation that re-issues DELETE with the acknowledgment flag.
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const actorName = actor.actorName ?? "unknown";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<Competition[]>("/api/competitions", {
        actorName,
        clientId: actor.clientId,
      });
      setCompetitions(result);
    } finally {
      setLoading(false);
    }
  }, [actorName, actor.clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(values: { name: string; date: string; venue: string }) {
    setFieldErrors(undefined);
    try {
      if (editState?.competition) {
        await apiRequest(`/api/competitions/${editState.competition.id}`, {
          method: "PUT",
          body: values,
          actorName,
          clientId: actor.clientId,
        });
      } else {
        await apiRequest("/api/competitions", {
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

  function startDelete(competition: Competition) {
    setPendingDelete(competition);
    setDeleteError(null);
    setNeedsConfirm(false);
  }

  function closeDelete() {
    setPendingDelete(null);
    setDeleteError(null);
    setNeedsConfirm(false);
  }

  async function confirmDelete(competition: Competition, confirmDestroysResults: boolean) {
    setDeleteError(null);
    try {
      await apiRequest(`/api/competitions/${competition.id}`, {
        method: "DELETE",
        body: { confirmDestroysResults },
        actorName,
        clientId: actor.clientId,
      });
      if (openId === competition.id) setOpenId(null);
      closeDelete();
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.response.code === "COMPETITION_LOCKED") {
          setDeleteError("cannot delete — competition is locked");
        } else if (error.response.code === "COMPETITION_DELETE_NEEDS_CONFIRMATION") {
          // Escalate: the operator must acknowledge that results will be lost.
          setNeedsConfirm(true);
          setDeleteError(null);
        } else {
          setDeleteError(error.response.message);
        }
      } else {
        throw error;
      }
    }
  }

  if (editState) {
    return (
      <CompetitionForm
        competition={editState.competition}
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
      <h1>Competitions</h1>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setEditState({})}>
          Add competition
        </button>
      </div>

      {loading && <p className="status-text">Loading…</p>}
      {!loading && competitions.length === 0 && (
        <p className="status-text">No competitions yet. Add one to get started.</p>
      )}

      {!loading && competitions.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Venue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {competitions.map((competition) => (
                <tr key={competition.id}>
                  <td>{competition.name}</td>
                  <td>{competition.date}</td>
                  <td>{competition.venue ?? "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn btn-small"
                        onClick={() => setOpenId(competition.id)}
                        disabled={openId === competition.id}
                      >
                        {openId === competition.id ? "Opened" : "Open"}
                      </button>
                      <button
                        className="btn btn-small"
                        onClick={() => setEditState({ competition })}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => startDelete(competition)}
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
            {needsConfirm ? (
              <p>
                {pendingDelete.name} has captured scores. Deleting it will destroy
                those results permanently. Are you sure?
              </p>
            ) : (
              <p>Delete {pendingDelete.name}?</p>
            )}
            {deleteError && (
              <p role="alert" className="field-error">
                {deleteError}
              </p>
            )}
            <div className="form-actions">
              <button
                className="btn btn-danger"
                onClick={() => {
                  confirmDelete(pendingDelete, needsConfirm);
                }}
              >
                {needsConfirm ? "Delete and destroy results" : "Confirm delete"}
              </button>
              <button className="btn" onClick={closeDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
