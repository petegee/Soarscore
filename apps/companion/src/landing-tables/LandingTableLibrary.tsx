import { useCallback, useEffect, useState } from "react";
import type { CompetitionRef, LandingBonusTable } from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import { LandingTableForm } from "./LandingTableForm.js";

interface EditState {
  table?: LandingBonusTable;
}

export function LandingTableLibrary({ actor }: { actor: Actor }) {
  const [tables, setTables] = useState<LandingBonusTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [pendingDelete, setPendingDelete] = useState<LandingBonusTable | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const actorName = actor.actorName ?? "unknown";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<LandingBonusTable[]>("/api/landing-tables", {
        actorName,
        clientId: actor.clientId,
      });
      setTables(result);
    } finally {
      setLoading(false);
    }
  }, [actorName, actor.clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(values: { name: string; entries: { distanceM: number; points: number }[] }) {
    setFieldErrors(undefined);
    try {
      if (editState?.table) {
        await apiRequest(`/api/landing-tables/${editState.table.id}`, {
          method: "PUT",
          body: values,
          actorName,
          clientId: actor.clientId,
        });
      } else {
        await apiRequest("/api/landing-tables", {
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

  async function duplicate(table: LandingBonusTable) {
    await apiRequest(`/api/landing-tables/${table.id}/duplicate`, {
      method: "POST",
      actorName,
      clientId: actor.clientId,
    });
    await refresh();
  }

  async function confirmDelete(table: LandingBonusTable) {
    setDeleteError(null);
    try {
      await apiRequest(`/api/landing-tables/${table.id}`, {
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

  if (editState) {
    return (
      <LandingTableForm
        table={editState.table}
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
      <h1>Landing-bonus tables</h1>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setEditState({})}>
          Add table
        </button>
      </div>

      {loading && <p className="status-text">Loading…</p>}
      {!loading && tables.length === 0 && (
        <p className="status-text">No landing tables yet. Add one to get started.</p>
      )}

      {!loading && tables.length > 0 && (
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Entries</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <tr key={table.id}>
                <td>{table.name}</td>
                <td>{table.entries.length}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-small" onClick={() => setEditState({ table })}>
                      Edit
                    </button>
                    <button className="btn btn-small" onClick={() => duplicate(table)}>
                      Duplicate
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => setPendingDelete(table)}
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
