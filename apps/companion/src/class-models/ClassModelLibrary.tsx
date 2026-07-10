import { useCallback, useEffect, useState } from "react";
import type {
  CompetitionRef,
  ContestClassModel,
  ModelFieldDeviation,
} from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import { ClassModelForm, type ClassModelSubmitValues } from "./ClassModelForm.js";

interface ClassModelDetail {
  model: ContestClassModel;
  deviations: ModelFieldDeviation[];
  readOnly: boolean;
}

export function ClassModelLibrary({ actor }: { actor: Actor }) {
  const [models, setModels] = useState<ContestClassModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModel, setEditModel] = useState<ContestClassModel | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [cloneState, setCloneState] = useState<{ source: ContestClassModel; name: string } | null>(
    null,
  );
  const [cloneErrors, setCloneErrors] = useState<Record<string, string[]> | undefined>();
  const [detail, setDetail] = useState<ClassModelDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContestClassModel | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const actorName = actor.actorName ?? "unknown";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<ContestClassModel[]>("/api/class-models", {
        actorName,
        clientId: actor.clientId,
      });
      setModels(result);
    } finally {
      setLoading(false);
    }
  }, [actorName, actor.clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function confirmClone(source: ContestClassModel, name: string) {
    setCloneErrors(undefined);
    try {
      await apiRequest(`/api/class-models/${source.id}/clone`, {
        method: "POST",
        body: { name },
        actorName,
        clientId: actor.clientId,
      });
      setCloneState(null);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.response.details as { fieldErrors?: Record<string, string[]> } | undefined;
        setCloneErrors(details?.fieldErrors ?? { name: [error.response.message] });
      } else {
        throw error;
      }
    }
  }

  async function handleSubmit(model: ContestClassModel, values: ClassModelSubmitValues) {
    setFieldErrors(undefined);
    try {
      await apiRequest(`/api/class-models/${model.id}`, {
        method: "PUT",
        body: values,
        actorName,
        clientId: actor.clientId,
      });
      setEditModel(null);
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

  async function showDeviations(model: ContestClassModel) {
    const result = await apiRequest<ClassModelDetail>(`/api/class-models/${model.id}`, {
      actorName,
      clientId: actor.clientId,
    });
    setDetail(result);
  }

  async function confirmDelete(model: ContestClassModel) {
    setDeleteError(null);
    try {
      await apiRequest(`/api/class-models/${model.id}`, {
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
        setDeleteError(names ? `cannot delete — used by: ${names}` : error.response.message);
      } else {
        throw error;
      }
    }
  }

  if (editModel) {
    return (
      <ClassModelForm
        model={editModel}
        fieldErrors={fieldErrors}
        onSubmit={(values) => handleSubmit(editModel, values)}
        onCancel={() => {
          setEditModel(null);
          setFieldErrors(undefined);
        }}
      />
    );
  }

  return (
    <div>
      <h1>Contest classes</h1>

      {loading && <p className="status-text">Loading…</p>}

      {!loading && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Basis</th>
                <th>Points/s</th>
                <th>Drop-worst</th>
                <th>Landing table</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id}>
                  <td>
                    {model.name}
                    {model.origin === "stock" && <span className="badge"> FAI stock</span>}
                  </td>
                  <td>{model.basis}</td>
                  <td>{model.pointsPerSecond ?? "—"}</td>
                  <td>
                    beyond {model.dropWorst.threshold} {model.dropWorst.unit}
                    {model.dropWorst.threshold === 1 ? "" : "s"}
                  </td>
                  <td>{model.landingTable ? model.landingTable.name : "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn btn-small"
                        onClick={() => {
                          setCloneState({ source: model, name: "" });
                          setCloneErrors(undefined);
                        }}
                      >
                        Clone
                      </button>
                      {model.origin === "custom" && (
                        <>
                          <button className="btn btn-small" onClick={() => setEditModel(model)}>
                            Edit
                          </button>
                          <button className="btn btn-small" onClick={() => showDeviations(model)}>
                            Deviations
                          </button>
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => {
                              setPendingDelete(model);
                              setDeleteError(null);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {model.origin === "stock" && (
                        <span className="hint">Clone to vary this class</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cloneState && (
        <div className="dialog-backdrop">
          <div role="dialog" className="dialog">
            <p>Clone {cloneState.source.name} into a custom class</p>
            <label htmlFor="clone-name">New name (required)</label>
            <input
              id="clone-name"
              value={cloneState.name}
              onChange={(event) =>
                setCloneState((current) => current && { ...current, name: event.target.value })
              }
              required
            />
            {cloneErrors?.name && (
              <p role="alert" className="field-error">
                {cloneErrors.name.join(", ")}
              </p>
            )}
            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={() => confirmClone(cloneState.source, cloneState.name)}
              >
                Clone
              </button>
              <button
                className="btn"
                onClick={() => {
                  setCloneState(null);
                  setCloneErrors(undefined);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="dialog-backdrop">
          <div role="dialog" className="dialog">
            <p>{detail.model.name} — deviations from FAI stock</p>
            {detail.deviations.length === 0 ? (
              <p className="status-text">No deviations from the stock rule.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Stock</th>
                    <th>Chosen</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.deviations.map((deviation) => (
                    <tr key={deviation.field}>
                      <td>{deviation.field}</td>
                      <td>{JSON.stringify(deviation.stockValue)}</td>
                      <td>{JSON.stringify(deviation.chosenValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="form-actions">
              <button className="btn" onClick={() => setDetail(null)}>
                Close
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
              <button className="btn btn-danger" onClick={() => confirmDelete(pendingDelete)}>
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
