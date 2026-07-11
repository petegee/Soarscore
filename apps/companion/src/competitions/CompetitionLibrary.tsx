import { useCallback, useEffect, useState } from "react";
import type { Competition, ContestClassModel } from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import { CompetitionForm, type CompetitionSubmitValues } from "./CompetitionForm.js";
import { RosterView } from "../roster/RosterView.js";

interface EditState {
  competition?: Competition;
}

export function CompetitionLibrary({ actor }: { actor: Actor }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  // The class-model catalogue populates the form selector and maps a
  // competition's classModelId to a display name in the table.
  const [classModels, setClassModels] = useState<ContestClassModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  // "Open" competition is a client-side selection only — the base holds no
  // open-competition session (D8).
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Competition | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // "Save as template" capture dialog (AC1): name only — configuration is
  // copied from the competition on the base.
  const [saveAsTemplate, setSaveAsTemplate] = useState<{
    competition: Competition;
    name: string;
  } | null>(null);
  const [saveAsTemplateErrors, setSaveAsTemplateErrors] = useState<
    Record<string, string[]> | undefined
  >();
  // Escalated once the base reports captured scores — a stronger, consequence
  // naming confirmation that re-issues DELETE with the acknowledgment flag.
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const actorName = actor.actorName ?? "unknown";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [comps, models] = await Promise.all([
        apiRequest<Competition[]>("/api/competitions", { actorName, clientId: actor.clientId }),
        apiRequest<ContestClassModel[]>("/api/class-models", {
          actorName,
          clientId: actor.clientId,
        }),
      ]);
      setCompetitions(comps);
      setClassModels(models);
    } finally {
      setLoading(false);
    }
  }, [actorName, actor.clientId]);

  const classModelName = (id: string) => classModels.find((m) => m.id === id)?.name ?? "—";

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(values: CompetitionSubmitValues) {
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
        // Server-authoritative hard block (RD2): a discipline change under
        // captured scores is refused; surface it against the discipline field.
        if (error.response.code === "COMPETITION_CLASS_LOCKED") {
          setFieldErrors({
            classModelId: ["Cannot change the contest class once scores are captured"],
          });
          return;
        }
        const details = error.response.details as { fieldErrors?: Record<string, string[]> } | undefined;
        setFieldErrors(details?.fieldErrors ?? { name: [error.response.message] });
      } else {
        throw error;
      }
    }
  }

  async function confirmSaveAsTemplate(pending: { competition: Competition; name: string }) {
    setSaveAsTemplateErrors(undefined);
    try {
      await apiRequest(`/api/competitions/${pending.competition.id}/save-as-template`, {
        method: "POST",
        body: { name: pending.name },
        actorName,
        clientId: actor.clientId,
      });
      setSaveAsTemplate(null);
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.response.details as { fieldErrors?: Record<string, string[]> } | undefined;
        setSaveAsTemplateErrors(details?.fieldErrors ?? { name: [error.response.message] });
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

  if (openId) {
    // The opened competition's roster screen (STORY-001-005). "Open" remains a
    // client-side selection only (D8).
    return <RosterView competitionId={openId} actor={actor} onBack={() => setOpenId(null)} />;
  }

  if (editState) {
    return (
      <CompetitionForm
        competition={editState.competition}
        classModels={classModels}
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
                <th>Class</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {competitions.map((competition) => (
                <tr key={competition.id}>
                  <td>{competition.name}</td>
                  <td>{competition.date}</td>
                  <td>{competition.venue ?? "—"}</td>
                  <td>{classModelName(competition.classModelId)}</td>
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
                        className="btn btn-small"
                        onClick={() => {
                          setSaveAsTemplate({ competition, name: "" });
                          setSaveAsTemplateErrors(undefined);
                        }}
                      >
                        Save as template
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

      {saveAsTemplate && (
        <div className="dialog-backdrop">
          <div role="dialog" className="dialog">
            <p>Save {saveAsTemplate.competition.name} as a template</p>

            <label htmlFor="save-as-template-name">Template name (required)</label>
            <input
              id="save-as-template-name"
              value={saveAsTemplate.name}
              onChange={(event) =>
                setSaveAsTemplate((current) => current && { ...current, name: event.target.value })
              }
              required
            />
            {saveAsTemplateErrors?.name && (
              <p role="alert" className="field-error">
                {saveAsTemplateErrors.name.join(", ")}
              </p>
            )}

            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  confirmSaveAsTemplate(saveAsTemplate);
                }}
              >
                Save template
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSaveAsTemplate(null);
                  setSaveAsTemplateErrors(undefined);
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
