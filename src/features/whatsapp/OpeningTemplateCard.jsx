import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { orgApi } from "../../api/saasApi.js";

const SOURCES = [
  { value: "name", label: "Lead's name" },
  { value: "phone", label: "Lead's phone" },
  { value: "email", label: "Lead's email" },
  { value: "company", label: "Company name" },
  { value: "fixed", label: "Fixed text" },
];

const STATUS_TONE = {
  APPROVED:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  PENDING:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  REJECTED: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const keyOf = (t) => `${t.name}::${t.language}`;
const varId = (v) => `${v.component}:${v.key}`;

function errorText(err) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Something went wrong. Please try again."
  );
}

/**
 * Lets the organization pick which of ITS OWN approved WhatsApp templates opens
 * a new conversation. Templates come from this organization's WABA only; the
 * backend re-validates the choice (approved + eligible) on save.
 */
export default function OpeningTemplateCard({ canManage }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null); // saved selection { name, language }
  const [pick, setPick] = useState("");
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await orgApi.openingTemplateOptions(refresh);
      const list = res?.data?.templates || [];
      setTemplates(list);
      setSelected(res?.data?.selected || null);
      const current = list.find((t) => t.isSelected);
      setPick(current ? keyOf(current) : "");
      const initial = {};
      (current?.variables || []).forEach((v) => {
        initial[varId(v)] = { source: v.source || "", value: v.value || "" };
      });
      setMapping(initial);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chosen = useMemo(
    () => templates.find((t) => keyOf(t) === pick) || null,
    [templates, pick],
  );
  const savedTemplate = useMemo(
    () => templates.find((t) => t.isSelected) || null,
    [templates],
  );
  const selectedIsBroken = Boolean(
    selected &&
    (!savedTemplate ||
      savedTemplate.status !== "APPROVED" ||
      !savedTemplate.eligibleForOpening),
  );
  const eligible = templates.filter(
    (t) => t.status === "APPROVED" && t.eligibleForOpening,
  );
  const others = templates.filter(
    (t) => !(t.status === "APPROVED" && t.eligibleForOpening),
  );

  const choose = (template) => {
    setPick(keyOf(template));
    setNotice("");
    const next = {};
    (template.variables || []).forEach((v) => {
      next[varId(v)] = { source: v.source || "", value: v.value || "" };
    });
    setMapping(next);
  };

  const missing = (chosen?.variables || []).some((v) => {
    const m = mapping[varId(v)];
    return !m?.source || (m.source === "fixed" && !m.value?.trim());
  });

  const save = async () => {
    if (!chosen) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await orgApi.openingTemplate({
        name: chosen.name,
        language: chosen.language,
        variables: (chosen.variables || []).map((v) => ({
          component: v.component,
          key: v.key,
          source: mapping[varId(v)].source,
          ...(mapping[varId(v)].source === "fixed"
            ? { value: mapping[varId(v)].value.trim() }
            : {}),
        })),
      });
      setNotice(
        `"${chosen.name}" will now open new conversations for your workspace.`,
      );
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="opening-template"
      className="card min-w-0 space-y-3 scroll-mt-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">
            Opening template
          </h2>
          <p className="text-xs text-ink-500">
            First message sent to a new lead. Only approved templates from your
            own WhatsApp Business Account can be used.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Sync
        </button>
      </div>

      {selected && !selectedIsBroken && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={15} />
          Active: <b>{selected.name}</b> · {selected.language}
        </p>
      )}
      {!selected && !loading && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          No opening template selected. New leads cannot be messaged on WhatsApp
          until you choose one.
        </p>
      )}
      {selectedIsBroken && !loading && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          Your selected template "{selected.name}" is no longer approved or
          available. Sending is blocked — choose another approved template.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 size={16} className="animate-spin" />
          Loading your templates…
        </div>
      ) : (
        <>
          {!eligible.length && (
            <p className="text-sm text-ink-500">
              You have no approved template that can be used as an opening
              message yet. Create one in Templates and wait for Meta's approval.
            </p>
          )}
          <ul className="space-y-2">
            {eligible.map((t) => (
              <li key={keyOf(t)}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${pick === keyOf(t) ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20" : "border-ink-100 dark:border-ink-800"}`}
                >
                  <input
                    type="radio"
                    name="opening-template"
                    className="mt-1"
                    disabled={!canManage}
                    checked={pick === keyOf(t)}
                    onChange={() => choose(t)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="break-all">{t.name}</b>
                      <span className="text-xs text-ink-500">
                        {t.language} · {t.category}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE.APPROVED}`}
                      >
                        APPROVED
                      </span>
                    </span>
                    <span className="mt-1 block whitespace-pre-line text-xs text-ink-500">
                      {
                        (t.components || []).find(
                          (c) => String(c.type).toUpperCase() === "BODY",
                        )?.text
                      }
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {chosen && (chosen.variables || []).length > 0 && (
            <div className="space-y-2 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50">
              <p className="text-xs font-semibold text-ink-700 dark:text-ink-200">
                Fill template variables for every lead
              </p>
              {chosen.variables.map((v) => {
                const m = mapping[varId(v)] || { source: "", value: "" };
                return (
                  <div
                    key={varId(v)}
                    className="grid gap-2 sm:grid-cols-[110px_1fr_1fr] sm:items-center"
                  >
                    <span className="text-xs text-ink-500">
                      {v.component} {"{{"}
                      {v.key}
                      {"}}"}
                    </span>
                    <select
                      className="input-field"
                      disabled={!canManage}
                      value={m.source}
                      onChange={(e) =>
                        setMapping((p) => ({
                          ...p,
                          [varId(v)]: { ...m, source: e.target.value },
                        }))
                      }
                    >
                      <option value="">Choose…</option>
                      {SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {m.source === "fixed" && (
                      <input
                        className="input-field"
                        disabled={!canManage}
                        placeholder="Text"
                        value={m.value}
                        onChange={(e) =>
                          setMapping((p) => ({
                            ...p,
                            [varId(v)]: { ...m, value: e.target.value },
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {canManage && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !chosen || missing}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Use as opening template
            </button>
          )}
          {!canManage && (
            <p className="text-xs text-ink-400">
              Only owners and managers can change this.
            </p>
          )}

          {others.length > 0 && (
            <details className="text-xs text-ink-500">
              <summary className="cursor-pointer">
                Not available for opening messages ({others.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {others.map((t) => (
                  <li
                    key={keyOf(t)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <b className="break-all">{t.name}</b>
                    <span>{t.language}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[t.status] || "bg-ink-100 text-ink-600"}`}
                    >
                      {t.status}
                    </span>
                    <span>
                      {t.status !== "APPROVED"
                        ? t.rejectedReason
                          ? `Rejected: ${t.rejectedReason}`
                          : "Not approved yet"
                        : (t.ineligibleReasons || []).join(" ")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
