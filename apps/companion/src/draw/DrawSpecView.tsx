import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  Competition,
  ConstraintWarning,
  DrawSpecification,
  FairnessMetric,
  LaneAllocationPolicy,
  SaveDrawSpecRequest,
} from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import { getDraw, saveDrawSpec } from "./api.js";

type FieldErrors = Record<string, string[]>;

// Transient, string-backed input mirror of the eight SaveDrawSpecRequest
// fields (numeric inputs held as strings, coerced only at submit). Never
// persisted and never the source of truth — the base is (D8/AC6). drawMode is
// a single-value union, so it is a submitted constant, not form state.
interface SpecFormState {
  roundCount: string;
  groupsPerRound: string;
  fairnessMetric: FairnessMetric;
  avoidConsecutiveFlights: boolean;
  lanePolicy: LaneAllocationPolicy;
  minGroupSizeOverride: string;
  allowSingleGroup: boolean;
}

// First-run defaults when no spec is saved yet (spec === null, AC1).
const defaultForm: SpecFormState = {
  roundCount: "4",
  groupsPerRound: "2",
  fairnessMetric: "min-max-then-excess",
  avoidConsecutiveFlights: false,
  lanePolicy: "rotate",
  minGroupSizeOverride: "",
  allowSingleGroup: false,
};

function seedForm(spec: DrawSpecification | null): SpecFormState {
  if (!spec) return defaultForm;
  return {
    roundCount: String(spec.roundCount),
    groupsPerRound: String(spec.groupsPerRound),
    fairnessMetric: spec.fairnessMetric,
    avoidConsecutiveFlights: spec.avoidConsecutiveFlights,
    lanePolicy: spec.lanePolicy,
    minGroupSizeOverride: spec.minGroupSizeOverride?.toString() ?? "",
    allowSingleGroup: spec.allowSingleGroup,
  };
}

// Defensive Zod-flatten extraction (RosterView idiom): the bound / not-found
// errors carry no fieldErrors, so never assume the shape exists.
function extractFieldErrors(error: ApiError): FieldErrors {
  const details = error.response.details as { fieldErrors?: FieldErrors } | undefined;
  return details?.fieldErrors ?? { groupsPerRound: [error.response.message] };
}

export function DrawSpecView({
  competitionId,
  actor,
  onBack,
}: {
  competitionId: string;
  actor: Actor;
  onBack: () => void;
}) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [form, setForm] = useState<SpecFormState>(defaultForm);
  // spec === null from GET .../draw is the first-run empty view, not an error.
  const [hasSpec, setHasSpec] = useState(false);
  const [warnings, setWarnings] = useState<ConstraintWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>();
  // DRAW_GROUP_SIZE_OUT_OF_BOUNDS / DRAW_SPEC_NOT_FOUND: message-only errors
  // surfaced verbatim at the top of the form (never recomputed client-side).
  const [alert, setAlert] = useState<string | null>(null);

  const actorName = actor.actorName ?? "unknown";
  const request = useCallback(
    <T,>(path: string, method?: string, body?: unknown) =>
      apiRequest<T>(path, { method, body, actorName, clientId: actor.clientId }),
    [actorName, actor.clientId],
  );

  // Re-fetch base state on mount — the sole source of spec truth, so a
  // replacement client re-derives the saved spec by construction (AC6).
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [evidence, comp] = await Promise.all([
        getDraw(request, competitionId),
        request<Competition>(`/api/competitions/${competitionId}`),
      ]);
      setForm(seedForm(evidence.spec));
      setHasSpec(evidence.spec !== null);
      setWarnings(evidence.warnings);
      setCompetition(comp);
    } finally {
      setLoading(false);
    }
  }, [request, competitionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function buildRequestBody(values: SpecFormState): SaveDrawSpecRequest {
    return {
      // Single legal value in MVP (progressive modes are a Future Enhancement).
      drawMode: "random-anti-repeat",
      roundCount: Number(values.roundCount),
      groupsPerRound: Number(values.groupsPerRound),
      fairnessMetric: values.fairnessMetric,
      avoidConsecutiveFlights: values.avoidConsecutiveFlights,
      lanePolicy: values.lanePolicy,
      minGroupSizeOverride:
        values.minGroupSizeOverride === "" ? null : Number(values.minGroupSizeOverride),
      allowSingleGroup: values.allowSingleGroup,
    };
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setFieldErrors(undefined);
    setAlert(null);
    setSaved(false);
    setSaving(true);
    try {
      // The PUT returns the full DrawEvidenceView, so the persisted spec
      // re-seeds the form without a second GET; the save replaces in place
      // (stable spec id, AC5) and the base records who saved it from the
      // apiRequest actor headers (D4, AC1/AC5).
      const next = await saveDrawSpec(request, competitionId, buildRequestBody(form));
      setForm(seedForm(next.spec));
      setHasSpec(next.spec !== null);
      // warnings[] may ride a 200 — soft advisories, never blocking.
      setWarnings(next.warnings);
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.response.code === "VALIDATION_FAILED") {
          // Includes the AC3 cross-field refine on groupsPerRound — rendered
          // as the per-field error, not the top-of-form alert.
          setFieldErrors(extractFieldErrors(error));
        } else if (
          error.response.code === "DRAW_GROUP_SIZE_OUT_OF_BOUNDS" ||
          error.response.code === "DRAW_SPEC_NOT_FOUND"
        ) {
          setAlert(error.response.message);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    } finally {
      setSaving(false);
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
      <h1>Draw spec — {competition.name}</h1>

      {!hasSpec && (
        <p className="status-text">
          No draw specification saved yet — review the defaults below and save
          to set this competition&apos;s fair-draw policy.
        </p>
      )}

      {alert && (
        <p role="alert" className="field-error">
          {alert}
        </p>
      )}

      <form onSubmit={handleSave} className="form">
        <label htmlFor="spec-draw-mode">Draw mode</label>
        {/* Single-value union — display-only so the form is honest; the
            constant is submitted from buildRequestBody. */}
        <p id="spec-draw-mode">
          random-anti-repeat <span className="hint">(the only mode in the MVP)</span>
        </p>

        <label htmlFor="spec-round-count">Round count (1–8)</label>
        <input
          id="spec-round-count"
          type="number"
          min={1}
          max={8}
          value={form.roundCount}
          onChange={(event) => setForm({ ...form, roundCount: event.target.value })}
          required
        />
        {fieldErrors?.roundCount && (
          <p role="alert" className="field-error">
            {fieldErrors.roundCount.join(", ")}
          </p>
        )}

        <label htmlFor="spec-groups-per-round">Groups per round</label>
        <input
          id="spec-groups-per-round"
          type="number"
          min={1}
          value={form.groupsPerRound}
          onChange={(event) => setForm({ ...form, groupsPerRound: event.target.value })}
          required
        />
        {fieldErrors?.groupsPerRound && (
          <p role="alert" className="field-error">
            {fieldErrors.groupsPerRound.join(", ")}
          </p>
        )}

        {/* The Area 4.1 spare-scorer override: kept adjacent to Groups per
            round and distinct — in control type, label and helper copy — from
            the numeric minimum-group-SIZE override below. */}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.allowSingleGroup}
            onChange={(event) => setForm({ ...form, allowSingleGroup: event.target.checked })}
          />
          Spare non-flying scorers are present (allows a single group per round)
        </label>

        <label htmlFor="spec-fairness-metric">Fairness metric</label>
        <select
          id="spec-fairness-metric"
          value={form.fairnessMetric}
          onChange={(event) =>
            setForm({ ...form, fairnessMetric: event.target.value as FairnessMetric })
          }
        >
          <option value="min-max-then-excess">
            Minimise worst repeat, then total excess (min-max-then-excess)
          </option>
          <option value="min-total-excess">Minimise total excess meetings (min-total-excess)</option>
          <option value="min-variance">Minimise variance — evenest spread (min-variance)</option>
        </select>

        <label htmlFor="spec-lane-policy">Lane allocation policy</label>
        <select
          id="spec-lane-policy"
          value={form.lanePolicy}
          onChange={(event) =>
            setForm({ ...form, lanePolicy: event.target.value as LaneAllocationPolicy })
          }
        >
          <option value="rotate">Rotate</option>
          <option value="fixed-by-contest-number">Fixed by contest number</option>
          <option value="random">Random</option>
        </select>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.avoidConsecutiveFlights}
            onChange={(event) =>
              setForm({ ...form, avoidConsecutiveFlights: event.target.checked })
            }
          />
          Avoid consecutive flights (last group of a round → first of the next)
        </label>

        <label htmlFor="spec-min-group-size">
          Minimum group size override (blank = class default)
        </label>
        <input
          id="spec-min-group-size"
          type="number"
          min={1}
          value={form.minGroupSizeOverride}
          onChange={(event) => setForm({ ...form, minGroupSizeOverride: event.target.value })}
        />
        {/* Honest helper copy: this relaxes the per-group minimum SIZE
            (allowing more, smaller groups) — it is NOT the two-group-minimum
            bypass; that is the spare-scorer checkbox above. */}
        <p className="hint">
          Relaxes the per-group minimum size, allowing more, smaller groups.
        </p>
        {fieldErrors?.minGroupSizeOverride && (
          <p role="alert" className="field-error">
            {fieldErrors.minGroupSizeOverride.join(", ")}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Save
          </button>
        </div>
      </form>

      {saved && <p className="status-text">Specification saved.</p>}

      {warnings.length > 0 && (
        <div className="status-text">
          {/* Soft advisories riding a successful response — visually distinct
              from field-error, never blocking (they re-surface at generate). */}
          {warnings.map((warning) => (
            <p key={warning.constraint}>
              <span className="badge">advisory</span> {warning.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
