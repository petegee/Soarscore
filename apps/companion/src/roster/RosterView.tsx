import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Competition, Pilot, RosterEntryView } from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";

type FieldErrors = Record<string, string[]>;

interface AddFormValues {
  pilotId: string;
  pilotNumber: string;
  pilotClass: string;
}

interface EditState {
  entry: RosterEntryView;
  pilotNumber: string;
  pilotClass: string;
}

interface ReplaceState {
  entry: RosterEntryView;
  pilotId: string;
  // Set once the base 409s ROSTER_REPLACE_AFFECTS_DRAW: the AC4 warning that
  // must be explicitly confirmed before re-submitting with the flag.
  needsConfirm: boolean;
  // Set on ROSTER_ENTRY_HAS_FLOWN: hard block, no retry path.
  hardBlocked: boolean;
  error: string | null;
}

const emptyAdd: AddFormValues = { pilotId: "", pilotNumber: "", pilotClass: "" };

function extractFieldErrors(error: ApiError): FieldErrors {
  const details = error.response.details as { fieldErrors?: FieldErrors } | undefined;
  return details?.fieldErrors ?? { pilotId: [error.response.message] };
}

export function RosterView({
  competitionId,
  actor,
  onBack,
}: {
  competitionId: string;
  actor: Actor;
  onBack: () => void;
}) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [roster, setRoster] = useState<RosterEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addValues, setAddValues] = useState<AddFormValues>(emptyAdd);
  const [addErrors, setAddErrors] = useState<FieldErrors | undefined>();
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editErrors, setEditErrors] = useState<FieldErrors | undefined>();
  const [replaceState, setReplaceState] = useState<ReplaceState | null>(null);
  const [rowError, setRowError] = useState<{ entryId: string; message: string } | null>(null);

  const actorName = actor.actorName ?? "unknown";
  const request = useCallback(
    <T,>(path: string, method?: string, body?: unknown) =>
      apiRequest<T>(path, { method, body, actorName, clientId: actor.clientId }),
    [actorName, actor.clientId],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [comp, allPilots, entries] = await Promise.all([
        request<Competition>(`/api/competitions/${competitionId}`),
        request<Pilot[]>("/api/pilots"),
        request<RosterEntryView[]>(`/api/competitions/${competitionId}/roster`),
      ]);
      setCompetition(comp);
      setPilots(allPilots);
      setRoster(entries);
    } finally {
      setLoading(false);
    }
  }, [request, competitionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rosteredPilotIds = new Set(roster.map((entry) => entry.pilotId));
  const availablePilots = pilots.filter((pilot) => !rosteredPilotIds.has(pilot.id));

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setAddErrors(undefined);
    try {
      await request(`/api/competitions/${competitionId}/roster`, "POST", {
        pilotId: addValues.pilotId,
        pilotNumber: addValues.pilotNumber === "" ? null : Number(addValues.pilotNumber),
        pilotClass: addValues.pilotClass === "" ? null : addValues.pilotClass,
      });
      setAdding(false);
      setAddValues(emptyAdd);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setAddErrors(extractFieldErrors(error));
      } else {
        throw error;
      }
    }
  }

  async function handleEditSave(edit: EditState) {
    setEditErrors(undefined);
    try {
      await request(`/api/competitions/${competitionId}/roster/${edit.entry.id}`, "PUT", {
        pilotNumber: edit.pilotNumber === "" ? null : Number(edit.pilotNumber),
        pilotClass: edit.pilotClass === "" ? null : edit.pilotClass,
      });
      setEditState(null);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setEditErrors(extractFieldErrors(error));
      } else {
        throw error;
      }
    }
  }

  async function handleRemove(entry: RosterEntryView) {
    setRowError(null);
    try {
      await request(`/api/competitions/${competitionId}/roster/${entry.id}`, "DELETE");
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.response.code === "ROSTER_REMOVE_REQUIRES_REPLACEMENT") {
          // AC3/AC4 boundary: guide the operator to the replace flow.
          setRowError({
            entryId: entry.id,
            message: "An accepted draw exists — use Replace instead of removing",
          });
        } else {
          setRowError({ entryId: entry.id, message: error.response.message });
        }
      } else {
        throw error;
      }
    }
  }

  async function submitReplace(state: ReplaceState, confirmDrawAffected: boolean) {
    try {
      await request(
        `/api/competitions/${competitionId}/roster/${state.entry.id}/replace`,
        "POST",
        { pilotId: state.pilotId, confirmDrawAffected },
      );
      setReplaceState(null);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.response.code === "ROSTER_REPLACE_AFFECTS_DRAW") {
          // AC4: surface the warning; re-submit with the flag only on
          // explicit confirmation.
          setReplaceState({ ...state, needsConfirm: true, error: null });
        } else if (error.response.code === "ROSTER_ENTRY_HAS_FLOWN") {
          setReplaceState({
            ...state,
            hardBlocked: true,
            error:
              "This entrant has flown — scores are captured against them. Ask the " +
              "Contest Director to retire them instead (retirement re-draws).",
          });
        } else {
          setReplaceState({ ...state, error: error.response.message });
        }
      } else {
        throw error;
      }
    }
  }

  if (loading || !competition) {
    return <p className="status-text">Loading…</p>;
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn" onClick={onBack}>
          ← Competitions
        </button>
      </div>
      <h1>Roster — {competition.name}</h1>

      <div className="toolbar">
        <button
          className="btn btn-primary"
          onClick={() => {
            setAdding(true);
            setAddErrors(undefined);
            setAddValues(emptyAdd);
          }}
          disabled={adding || availablePilots.length === 0}
        >
          Add entrant
        </button>
        {availablePilots.length === 0 && !adding && (
          <span className="status-text">All library pilots are rostered.</span>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="form">
          <label htmlFor="roster-pilot">Pilot (required)</label>
          <select
            id="roster-pilot"
            value={addValues.pilotId}
            onChange={(event) => setAddValues({ ...addValues, pilotId: event.target.value })}
            required
          >
            <option value="">Select a pilot…</option>
            {availablePilots.map((pilot) => (
              <option key={pilot.id} value={pilot.id}>
                {pilot.name}
              </option>
            ))}
          </select>
          {addErrors?.pilotId && (
            <p role="alert" className="field-error">
              {addErrors.pilotId.join(", ")}
            </p>
          )}

          {competition.pilotNumbersEnabled && (
            <>
              <label htmlFor="roster-number">Pilot number (blank = auto-assign)</label>
              <input
                id="roster-number"
                type="number"
                min={1}
                value={addValues.pilotNumber}
                onChange={(event) =>
                  setAddValues({ ...addValues, pilotNumber: event.target.value })
                }
              />
              {addErrors?.pilotNumber && (
                <p role="alert" className="field-error">
                  {addErrors.pilotNumber.join(", ")}
                </p>
              )}
            </>
          )}

          {competition.pilotClassesEnabled && (
            <>
              <label htmlFor="roster-class">Class (required)</label>
              <select
                id="roster-class"
                value={addValues.pilotClass}
                onChange={(event) =>
                  setAddValues({ ...addValues, pilotClass: event.target.value })
                }
                required
              >
                <option value="">Select a class…</option>
                {competition.pilotClasses.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {addErrors?.pilotClass && (
                <p role="alert" className="field-error">
                  {addErrors.pilotClass.join(", ")}
                </p>
              )}
            </>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Add
            </button>
            <button type="button" className="btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {roster.length === 0 && !adding && (
        <p className="status-text">No entrants yet. Add pilots from the library.</p>
      )}

      {roster.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {competition.pilotNumbersEnabled && <th>#</th>}
                <th>Pilot</th>
                {competition.pilotClassesEnabled && <th>Class</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roster.map((entry) => {
                const editing = editState?.entry.id === entry.id;
                return (
                  <tr key={entry.id}>
                    {competition.pilotNumbersEnabled && (
                      <td>
                        {editing ? (
                          <input
                            type="number"
                            min={1}
                            aria-label="Pilot number"
                            value={editState.pilotNumber}
                            onChange={(event) =>
                              setEditState({ ...editState, pilotNumber: event.target.value })
                            }
                          />
                        ) : (
                          entry.pilotNumber ?? "—"
                        )}
                        {editing && editErrors?.pilotNumber && (
                          <p role="alert" className="field-error">
                            {editErrors.pilotNumber.join(", ")}
                          </p>
                        )}
                      </td>
                    )}
                    <td>
                      {entry.pilotName}
                      {entry.retired && <span className="badge"> (retired)</span>}
                    </td>
                    {competition.pilotClassesEnabled && (
                      <td>
                        {editing ? (
                          <select
                            aria-label="Pilot class"
                            value={editState.pilotClass}
                            onChange={(event) =>
                              setEditState({ ...editState, pilotClass: event.target.value })
                            }
                          >
                            <option value="">Select a class…</option>
                            {competition.pilotClasses.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          entry.pilotClass ?? "—"
                        )}
                        {editing && editErrors?.pilotClass && (
                          <p role="alert" className="field-error">
                            {editErrors.pilotClass.join(", ")}
                          </p>
                        )}
                      </td>
                    )}
                    <td>
                      <div className="row-actions">
                        {editing ? (
                          <>
                            <button
                              className="btn btn-small btn-primary"
                              onClick={() => handleEditSave(editState)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => {
                                setEditState(null);
                                setEditErrors(undefined);
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {(competition.pilotNumbersEnabled ||
                              competition.pilotClassesEnabled) && (
                              <button
                                className="btn btn-small"
                                disabled={entry.retired}
                                onClick={() => {
                                  setEditErrors(undefined);
                                  setEditState({
                                    entry,
                                    pilotNumber: entry.pilotNumber?.toString() ?? "",
                                    pilotClass: entry.pilotClass ?? "",
                                  });
                                }}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              className="btn btn-small"
                              disabled={entry.retired}
                              onClick={() =>
                                setReplaceState({
                                  entry,
                                  pilotId: "",
                                  needsConfirm: false,
                                  hardBlocked: false,
                                  error: null,
                                })
                              }
                            >
                              Replace
                            </button>
                            <button
                              className="btn btn-small btn-danger"
                              disabled={entry.retired}
                              onClick={() => handleRemove(entry)}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                      {rowError?.entryId === entry.id && (
                        <p role="alert" className="field-error">
                          {rowError.message}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {replaceState && (
        <div className="dialog-backdrop">
          <div role="dialog" className="dialog">
            {replaceState.hardBlocked ? (
              <p role="alert" className="field-error">
                {replaceState.error}
              </p>
            ) : replaceState.needsConfirm ? (
              <p>
                Replacing {replaceState.entry.pilotName} affects the draw and lane
                allocations — the replacement inherits this entrant&apos;s slots.
                Continue?
              </p>
            ) : (
              <>
                <p>Replace {replaceState.entry.pilotName} with:</p>
                <select
                  aria-label="Replacement pilot"
                  value={replaceState.pilotId}
                  onChange={(event) =>
                    setReplaceState({ ...replaceState, pilotId: event.target.value })
                  }
                >
                  <option value="">Select a pilot…</option>
                  {availablePilots.map((pilot) => (
                    <option key={pilot.id} value={pilot.id}>
                      {pilot.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {!replaceState.hardBlocked && replaceState.error && (
              <p role="alert" className="field-error">
                {replaceState.error}
              </p>
            )}
            <div className="form-actions">
              {!replaceState.hardBlocked && (
                <button
                  className="btn btn-primary"
                  disabled={replaceState.pilotId === ""}
                  onClick={() => submitReplace(replaceState, replaceState.needsConfirm)}
                >
                  {replaceState.needsConfirm ? "Replace and affect draw" : "Replace"}
                </button>
              )}
              <button className="btn" onClick={() => setReplaceState(null)}>
                {replaceState.hardBlocked ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
