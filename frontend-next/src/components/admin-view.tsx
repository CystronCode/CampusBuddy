"use client";
import { useEffect, useState } from "react";
import { Upload, RefreshCw, Check, FileText, Code2, Plus, Trash2 } from "lucide-react";
import {
  type Workspace,
  useRemote,
  ErrorBox,
  Loading,
} from "@/components/campus-app";
import { api, text, prettyDate, type Job, type DataRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DemoBadge, Empty } from "@/components/result-cards";
import { TimetableCardTable } from "@/components/timetable-card-table";
import { normalizeDay } from "@/lib/timetable-legend";

interface SystemInfo {
  verification?: {
    backend: {
      passed: number;
      failures: number;
      errors: number;
      skipped: number;
    };
    browser: { passed: number; failed: number };
    executed_at: string;
  } | null;
  counts: Record<string, number>;
  traces: {
    id: string;
    route: string;
    tools: { tool: string; latency_ms: number; success: boolean }[];
    latency_ms: number;
    success: boolean;
    result_count: number;
    created_at: string;
  }[];
  sources: {
    id: string;
    filename: string;
    kind: string;
    demo: boolean;
    created_at: string;
  }[];
  audit: {
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }[];
  models: Record<string, string>;
  tools: string[];
}

export function AdminView({
  w,
  developer,
}: {
  w: Workspace;
  developer: boolean;
}) {
  const [kind, setKind] = useState("timetable");
  const [file, setFile] = useState<File | null>(null);
  const [department, setDepartment] = useState(
    w.profile.role === "department_admin" ? w.profile.department : "All",
  );
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Notice");
  const [topic, setTopic] = useState("");
  const [claim, setClaim] = useState("");
  const [demo, setDemo] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [editableRecords, setEditableRecords] = useState<DataRecord[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("imports");
  const [jobFilter, setJobFilter] = useState("all");
  const system = useRemote<SystemInfo>("/v1/admin/system", w);
  const jobs = useRemote<Job[]>("/v1/ingestion", w);
  useEffect(() => {
    if (!job || !["queued", "processing"].includes(job.status)) return;
    let active = true;
    const timer = setInterval(() => {
      api<Job[]>("/v1/ingestion", w.session, w.tenant)
        .then((rows) => {
          const next = rows.find((j) => j.id === job.id);
          if (active && next) {
            setJob(next);
            setEditableRecords(next.preview.records || []);
            if (!["queued", "processing"].includes(next.status)) w.refresh();
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [job?.id, job?.status, w.session, w.tenant]);
  function selectJob(next: Job) {
    setJob(next);
    setEditableRecords(next.preview.records ? next.preview.records.map((r) => ({ ...r })) : []);
    setMapping(next.preview.mapping || {});
  }
  async function preview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append(
        "options",
        JSON.stringify({
          kind,
          department,
          title,
          category,
          topic,
          claim,
          demo,
        }),
      );
      const next = await api<Job>(
        "/v1/ingestion/preview",
        w.session,
        w.tenant,
        { method: "POST", body: form },
      );
      selectJob(next);
      w.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(action: "mapping" | "confirm" | "retry") {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const bodyPayload =
        action === "mapping"
          ? JSON.stringify({ mapping })
          : action === "confirm"
            ? JSON.stringify({ records: editableRecords })
            : undefined;
      const next = await api<Job>(
        `/v1/ingestion/${job.id}/${action}`,
        w.session,
        w.tenant,
        {
          method: "POST",
          body: bodyPayload,
        },
      );
      selectJob(next);
      w.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {developer
              ? "OBSERVABILITY & INTEROPERABILITY"
              : "KEEP YOUR CAMPUS CONNECTED"}
          </div>
          <h1>{developer ? "System Intelligence" : "Admin Console"}</h1>
          <p>
            {developer
              ? "Actual service activity, source freshness and approved tools."
              : "Turn institutional files into answers students can trust."}
          </p>
        </div>
        <Button variant="outline" onClick={w.refresh}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>
      <ErrorBox message={error || system.error || jobs.error} />
      {developer ? (
        system.loading ? (
          <Loading />
        ) : (
          system.data && (
            <>
              <div className="stat-grid">
                {Object.entries(system.data.counts).map(([key, value]) => (
                  <div className="stat" key={key}>
                    <strong>{value}</strong>
                    <span>{key.replace("_", " ")} records</span>
                  </div>
                ))}
              </div>
              <section className="panel">
                <h2>Query inspection</h2>
                <p className="subtle">
                  Your authenticated activity in this institution. No question
                  text is written to application logs.
                </p>
                {system.data.traces.length ? (
                  system.data.traces.map((t) => (
                    <details className="more-results" key={t.id}>
                      <summary>
                        {t.route} · {t.latency_ms.toFixed(1)} ms ·{" "}
                        {t.result_count} result(s) ·{" "}
                        {t.success ? "Success" : "Failed"}
                      </summary>
                      <div className="data-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Tool</th>
                              <th>Latency</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.tools.map((tool, i) => (
                              <tr key={i}>
                                <td>{tool.tool}</td>
                                <td>{tool.latency_ms} ms</td>
                                <td>{tool.success ? "Success" : "Failed"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))
                ) : (
                  <Empty
                    message="No queries yet"
                    hint="Ask CampusOS a question, then refresh this panel."
                  />
                )}
              </section>
              <section className="panel section-gap">
                <h2>
                  <Code2
                    size={17}
                    style={{ display: "inline", marginRight: 7 }}
                  />
                  MCP tools
                </h2>
                <p className="subtle" style={{ marginTop: 10 }}>
                  These tools share the same tenant-aware services as the API.
                  Stdio requires your access token and tenant ID.
                </p>
                <div className="data-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Approved read-only tool</th>
                      </tr>
                    </thead>
                    <tbody>
                      {system.data.tools.map((t) => (
                        <tr key={t}>
                          <td>{t}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="subtle">
                  Synthesis: {system.data.models.synthesis} · Embeddings:{" "}
                  {system.data.models.embeddings}
                </p>
                {system.data.verification ? (
                  <div className="success">
                    <strong>Executed verification</strong>
                    <p>
                      Backend: {system.data.verification.backend.passed} passed
                      · {system.data.verification.backend.skipped} skipped.
                      Browser: {system.data.verification.browser.passed} passed
                      · {system.data.verification.browser.failed} failed.
                    </p>
                    <p>
                      Report:{" "}
                      {new Date(
                        system.data.verification.executed_at,
                      ).toLocaleString("en-IN")}
                      . Cloud integrations require separate live verification.
                    </p>
                  </div>
                ) : (
                  <p className="subtle">
                    No executed verification report is installed. Run
                    scripts/verify.py to create one.
                  </p>
                )}
              </section>
            </>
          )
        )
      ) : (
        <>
          <div className="tabs">
            <button
              aria-pressed={tab === "imports"}
              onClick={() => setTab("imports")}
            >
              Import data
            </button>
            <button
              aria-pressed={tab === "sources"}
              onClick={() => setTab("sources")}
            >
              Sources & freshness
            </button>
            {["institution_admin", "platform_admin"].includes(
              w.profile.role,
            ) && (
              <button
                aria-pressed={tab === "members"}
                onClick={() => setTab("members")}
              >
                People & roles
              </button>
            )}
            <button
              aria-pressed={tab === "audit"}
              onClick={() => setTab("audit")}
            >
              Audit log
            </button>
          </div>
          {tab === "imports" ? (
            <>
              <section className="upload-zone">
                <h2>
                  <Upload
                    size={18}
                    style={{ display: "inline", marginRight: 8 }}
                  />
                  Bring your campus information together
                </h2>
                <p>
                  1. Choose a file · 2. Review and map columns · 3. Confirm your
                  import
                </p>
                <form onSubmit={preview}>
                  <div className="upload-grid">
                    <div>
                      <label htmlFor="import-type">
                        What are you importing?
                      </label>
                      <select
                        id="import-type"
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value);
                          setJob(null);
                        }}
                      >
                        <option value="timetable">Class timetable</option>
                        <option value="faculty">Faculty directory</option>
                        <option value="menu">Canteen menu</option>
                        <option value="events">Events and examinations</option>
                        <option value="document">Notice or document</option>
                        <option value="exceptions">
                          Date-specific timetable changes
                        </option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="import-department">Department</label>
                      <input
                        id="import-department"
                        value={department}
                        disabled={w.profile.role === "department_admin"}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="All or your department code"
                      />
                    </div>
                    <div>
                      <label htmlFor="import-file">
                        Source file (up to 15 MB)
                      </label>
                      <input
                        id="import-file"
                        type="file"
                        accept={
                          kind === "document"
                            ? ".pdf,.txt,.md,.png,.jpg,.jpeg"
                            : ".pdf,.csv,.xlsx,.json,.png,.jpg,.jpeg"
                        }
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          marginTop: 26,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={demo}
                          onChange={(e) => setDemo(e.target.checked)}
                        />
                        Mark as sample data
                      </label>
                    </div>
                    {kind === "document" && (
                      <>
                        <div>
                          <label htmlFor="doc-title">Document title</label>
                          <input
                            id="doc-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={300}
                          />
                        </div>
                        <div>
                          <label htmlFor="doc-category">Category</label>
                          <input
                            id="doc-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                          />
                        </div>
                        <div>
                          <label htmlFor="doc-topic">
                            Claim topic (optional, for conflict checks)
                          </label>
                          <input
                            id="doc-topic"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="internal-assessment-date"
                          />
                        </div>
                        <div>
                          <label htmlFor="doc-claim">
                            Recorded claim (optional)
                          </label>
                          <input
                            id="doc-claim"
                            value={claim}
                            onChange={(e) => setClaim(e.target.value)}
                            placeholder="2026-11-03"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    type="submit"
                    style={{ marginTop: 20 }}
                    disabled={busy || !file}
                  >
                    <FileText size={15} />
                    {busy ? "Reading your file…" : "Preview file"}
                  </Button>
                </form>
              </section>
              {job && (
                <section className="panel">
                  <div className="section-header">
                    <h2>Review your import</h2>
                    <span className="demo-badge">{job.status}</span>
                  </div>
                  {job.preview.message && <p>{job.preview.message}</p>}
                  {job.status === "completed" && (
                    <div className="success" role="status">
                      <Check
                        size={15}
                        style={{ display: "inline", marginRight: 7 }}
                      />
                      {job.preview.imported_count ??
                        job.preview.valid_count ??
                        "Your"}{" "}
                      records imported. Student queries can use them now.
                    </div>
                  )}
                  {["queued", "processing"].includes(job.status) && (
                    <div className="loading" role="status">
                      Your file is {job.status}. This page will update
                      automatically. Keep the backend worker running.
                    </div>
                  )}
                  {job.error && <ErrorBox message={job.error} />}{" "}
                  {!!job.preview.fields?.length && job.status === "preview" && (
                    <>
                      <p className="subtle">
                        Match your spreadsheet columns to the fields below.
                        Required fields have an asterisk.
                      </p>
                      <div className="mapping-grid">
                        {job.preview.fields.map((f) => (
                          <div key={f.name}>
                            <label htmlFor={`map-${f.name}`}>
                              {f.name.replaceAll("_", " ")}
                              {f.required ? " *" : ""}
                            </label>
                            <select
                              id={`map-${f.name}`}
                              value={mapping[f.name] || ""}
                              onChange={(e) =>
                                setMapping((m) => ({
                                  ...m,
                                  [f.name]: e.target.value,
                                }))
                              }
                            >
                              <option value="">
                                {f.required
                                  ? "Choose column"
                                  : "Use default / not supplied"}
                              </option>
                              {job.preview.columns?.map((col) => (
                                <option value={col} key={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => action("mapping")}
                        disabled={busy}
                      >
                        Validate mapping
                      </Button>
                    </>
                  )}
                  {!!job.preview.error_count && (
                    <>
                      <ErrorBox
                        message={`${job.preview.error_count} record(s) need attention. Correct the file or mapping, then validate again.`}
                      />
                      <ul
                        className="subtle"
                        style={{ margin: "15px 0", paddingLeft: 20 }}
                      >
                        {job.preview.errors?.slice(0, 12).map((e, i) => (
                          <li key={i}>
                            Row {e.row}: {e.message}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {editableRecords.length > 0 && (
                    (kind === "timetable" ||
                      job.data_type === "timetable" ||
                      (job.preview.columns &&
                        (job.preview.columns.includes("day") &&
                          job.preview.columns.includes("start_time")))) ? (
                      /* 1. Timetable: Table format only for timetable */
                      <TimetableCardTable
                        records={editableRecords}
                        editable={job.status === "preview"}
                        onChange={setEditableRecords}
                      />
                    ) : (kind === "menu" || job.data_type === "menu") ? (
                      /* 2. Menu: List format for menu */
                      <MenuListPreview
                        records={editableRecords}
                        editable={job.status === "preview"}
                        onChange={setEditableRecords}
                      />
                    ) : (kind === "faculty" || job.data_type === "faculty") ? (
                      /* Faculty records list preview */
                      <FacultyListPreview
                        records={editableRecords}
                        editable={job.status === "preview"}
                        onChange={setEditableRecords}
                      />
                    ) : (
                      /* 3. Paragraph / Narrative format for other things (circulars, notices, syllabus) */
                      <ParagraphPreview
                        records={editableRecords}
                        editable={job.status === "preview"}
                        onChange={setEditableRecords}
                      />
                    )
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                    {job.status === "preview" && (
                      <Button
                        onClick={() => action("confirm")}
                        disabled={busy || !!job.preview.error_count}
                      >
                        <Check size={15} />
                        Confirm import · {editableRecords.length} records
                      </Button>
                    )}
                    {job.status === "failed" && (
                      <Button variant="outline" onClick={() => action("retry")}>
                        Preview and retry
                      </Button>
                    )}
                  </div>
                </section>
              )}
              <section className="panel section-gap">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Recent Imports by Document Type</h2>
                    <p className="subtle" style={{ margin: "4px 0 0", fontSize: 12.5 }}>
                      Review uploaded campus documents grouped and tagged by extraction category.
                    </p>
                  </div>
                  <div className="switch" style={{ flexWrap: "wrap" }}>
                    {[
                      { id: "all", label: `All (${jobs.data?.length ?? 0})` },
                      { id: "timetable", label: `Timetables (${jobs.data?.filter(j => j.data_type === "timetable").length ?? 0})` },
                      { id: "faculty", label: `Faculty (${jobs.data?.filter(j => j.data_type === "faculty").length ?? 0})` },
                      { id: "menu", label: `Menus (${jobs.data?.filter(j => j.data_type === "menu").length ?? 0})` },
                      { id: "notices", label: `Notices (${jobs.data?.filter(j => ["notices", "circular"].includes(j.data_type || "")).length ?? 0})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={jobFilter === f.id ? "on" : ""}
                        onClick={() => setJobFilter(f.id)}
                        style={{ fontSize: 12, padding: "5px 11px" }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {jobs.data?.length ? (
                  (() => {
                    const filtered = jobs.data.filter((j) => {
                      if (jobFilter === "all") return true;
                      if (jobFilter === "notices") return ["notices", "circular"].includes(j.data_type || "");
                      return j.data_type === jobFilter;
                    });

                    if (!filtered.length) {
                      return (
                        <div className="mute" style={{ padding: "20px 0", textAlign: "center" }}>
                          No imports found for this category.
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: "grid", gap: 10 }}>
                        {filtered.map((j) => {
                          const dt = (j.data_type || "document").toLowerCase();
                          let typeBadge = <span className="badge">📄 Document</span>;
                          if (dt === "timetable") {
                            typeBadge = <span className="badge b-adm">📅 Timetable</span>;
                          } else if (dt === "faculty") {
                            typeBadge = <span className="badge" style={{ background: "#f3e8ff", color: "#7e22ce", borderColor: "#d8b4fe" }}>👨‍🏫 Faculty Directory</span>;
                          } else if (dt === "menu") {
                            typeBadge = <span className="badge" style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}>🍽️ Canteen Menu</span>;
                          } else if (dt === "notices" || dt === "circular") {
                            typeBadge = <span className="badge b-stu">📢 Notice / Circular</span>;
                          } else if (dt === "calendar" || dt === "events") {
                            typeBadge = <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" }}>🗓️ Calendar</span>;
                          }

                          const statusBadge = j.status === "completed"
                            ? <span className="badge b-adm" style={{ fontSize: 10 }}>Approved</span>
                            : j.status === "preview"
                              ? <span className="badge b-stu" style={{ fontSize: 10 }}>Ready to Review</span>
                              : <span className="badge" style={{ fontSize: 10 }}>{j.status}</span>;

                          return (
                            <div
                              className="job-row"
                              key={j.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 14,
                                padding: "14px 18px",
                                background: "#fff",
                                borderRadius: 12,
                                border: "1px solid var(--line)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, flex: 1 }}>
                                <div style={{ marginTop: 2 }}>{typeBadge}</div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                                    <strong style={{ fontSize: 13.5, color: "var(--foreground)" }}>
                                      {j.preview.valid_count ?? j.preview.imported_count ?? "Document"} records extracted
                                    </strong>
                                    {statusBadge}
                                  </div>
                                  <p className="mute" style={{ fontSize: 12, margin: 0 }}>
                                    Imported {prettyDate(j.created_at)} · {j.error || `${j.attempts} processing attempt(s)`}
                                  </p>
                                </div>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => selectJob(j)}>
                                Review & Confirm
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : (
                  <Empty
                    message="No imports yet"
                    hint="Choose a source above to start."
                  />
                )}
              </section>
            </>
          ) : tab === "sources" ? (
            <section className="panel">
              <h2>Original sources</h2>
              {system.data?.sources.map((s) => (
                <div className="job-row" key={s.id}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{s.filename}</strong>
                    <p>
                      {s.kind} ·{" "}
                      {new Date(s.created_at).toLocaleString("en-IN")}
                      {s.demo && (
                        <>
                          {" "}
                          · <DemoBadge />
                        </>
                      )}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="outline" onClick={() => w.download(s.id)}>
                      View original
                    </Button>
                    {s.kind === "document" && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const next = await api<Job>(
                              `/v1/sources/${s.id}/reindex`,
                              w.session,
                              w.tenant,
                              { method: "POST" },
                            );
                            selectJob(next);
                            setTab("imports");
                            w.refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Re-index
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          ) : tab === "members" ? (
            <Members w={w} />
          ) : (
            <section className="panel">
              <h2>Your administrative actions</h2>
              {system.data?.audit.length ? (
                system.data.audit.map((a, i) => (
                  <div className="job-row" key={i}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{a.action}</strong>
                      <p>{new Date(a.created_at).toLocaleString("en-IN")}</p>
                      <p>
                        {Object.entries(a.details)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <Empty message="No administrative actions recorded" />
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

const PREVIEW_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function PreviewTable({
  records,
  columns,
  editable = false,
  onChange,
}: {
  records: DataRecord[];
  columns?: string[];
  editable?: boolean;
  onChange?: (next: DataRecord[]) => void;
}) {
  const fields = columns?.length ? columns : Object.keys(records[0] || {});

  function updateCell(rowIdx: number, field: string, value: string) {
    if (!onChange) return;
    const next = records.map((r, i) => (i === rowIdx ? { ...r, [field]: value } : r));
    onChange(next);
  }

  function removeRow(rowIdx: number) {
    if (!onChange) return;
    onChange(records.filter((_, i) => i !== rowIdx));
  }

  function addRow() {
    if (!onChange) return;
    const blank: DataRecord = {};
    for (const f of fields) {
      blank[f] = f === "day" ? "Monday" : f === "kind" ? "lecture" : "";
    }
    onChange([...records, blank]);
  }

  return (
    <div>
      {editable && onChange && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span className="subtle" style={{ fontSize: 12 }}>
            Editable preview table — modify any cell or remove unwanted rows before confirming import.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus size={13} /> Add row
          </Button>
        </div>
      )}
      <div className="data-table-wrap">
        <table>
          <caption className="sr-only">Normalized import preview</caption>
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f}>{f.replaceAll("_", " ")}</th>
              ))}
              {editable && onChange && <th style={{ width: 60 }}>Remove</th>}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i}>
                {fields.map((f) => {
                  const val = Array.isArray(r[f])
                    ? (r[f] as unknown[]).join(", ")
                    : text(r[f]);
                  if (!editable || !onChange) {
                    return <td key={f}>{val}</td>;
                  }
                  if (f === "day" || f === "day_of_week") {
                    const dayVal = normalizeDay(val);
                    return (
                      <td key={f}>
                        <select
                          value={dayVal}
                          onChange={(e) => updateCell(i, f, e.target.value)}
                          style={{ minHeight: 30, padding: "3px 6px", fontSize: 12 }}
                        >
                          {PREVIEW_DAYS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  }
                  return (
                    <td key={f}>
                      <input
                        value={val}
                        onChange={(e) => updateCell(i, f, e.target.value)}
                        style={{
                          minHeight: 30,
                          padding: "3px 7px",
                          fontSize: 12,
                          minWidth: f.includes("name") || f === "subject" ? 150 : 85,
                        }}
                      />
                    </td>
                  );
                })}
                {editable && onChange && (
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(i)}
                      title="Remove row"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MenuListPreview({
  records,
  editable = false,
  onChange,
}: {
  records: DataRecord[];
  editable?: boolean;
  onChange?: (next: DataRecord[]) => void;
}) {
  function updateItem(rowIdx: number, field: string, value: unknown) {
    if (!onChange) return;
    const next = records.map((r, i) => (i === rowIdx ? { ...r, [field]: value } : r));
    onChange(next);
  }

  function removeItem(rowIdx: number) {
    if (!onChange) return;
    onChange(records.filter((_, i) => i !== rowIdx));
  }

  function addItem() {
    if (!onChange) return;
    onChange([
      ...records,
      { item: "New Menu Item", price: 50, is_veg: true, meal: "lunch" },
    ]);
  }

  return (
    <div className="panel" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Canteen Menu List ({records.length} items)
          </h3>
          <p className="subtle" style={{ fontSize: 12, margin: "2px 0 0" }}>
            Scanned dishes displayed in list format with prices and dietary tags.
          </p>
        </div>
        {editable && onChange && (
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus size={13} /> Add item
          </Button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {records.map((r, i) => {
          const itemName = text(r.item || r.item_name || r.name || "Dish");
          const price = text(r.price || "25");
          const meal = text(r.meal || "lunch").toLowerCase();
          const isVeg = r.is_veg === true || r.vegetarian === true || String(r.is_veg).toLowerCase() === "true";

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: isVeg ? "#16a34a" : "#dc2626",
                    flexShrink: 0,
                  }}
                  title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
                />
                {editable && onChange ? (
                  <input
                    value={itemName}
                    onChange={(e) => updateItem(i, "item", e.target.value)}
                    style={{
                      flex: 1,
                      minHeight: 32,
                      padding: "4px 8px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                    }}
                    placeholder="Dish Name"
                  />
                ) : (
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{itemName}</span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {editable && onChange ? (
                  <>
                    <select
                      value={meal}
                      onChange={(e) => updateItem(i, "meal", e.target.value)}
                      style={{ minHeight: 32, padding: "2px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    >
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="snacks">Snacks</option>
                      <option value="dinner">Dinner</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => updateItem(i, "is_veg", !isVeg)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        background: isVeg ? "#dcfce7" : "#fee2e2",
                        color: isVeg ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {isVeg ? "Veg" : "Non-Veg"}
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>₹</span>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => updateItem(i, "price", Number(e.target.value))}
                        style={{
                          width: 65,
                          minHeight: 32,
                          padding: "2px 6px",
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                        }}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(i)}
                      title="Remove dish"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#e2e8f0",
                        textTransform: "capitalize",
                        fontWeight: 600,
                      }}
                    >
                      {meal}
                    </span>
                    <strong style={{ fontSize: 14, color: "#0f172a" }}>₹{price}</strong>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FacultyListPreview({
  records,
  editable = false,
  onChange,
}: {
  records: DataRecord[];
  editable?: boolean;
  onChange?: (next: DataRecord[]) => void;
}) {
  return (
    <div className="panel" style={{ padding: "18px 22px" }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>
          Faculty Directory ({records.length} {records.length === 1 ? "profile" : "profiles"})
        </h3>
        <p className="subtle" style={{ fontSize: 12, margin: "3px 0 0" }}>
          Full extracted profiles, qualifications, research, publications, and all paragraphs of the document.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {records.map((r, i) => {
          const rawDoc = text(r.raw_text);
          const bio = text(r.bio);
          const subjects = Array.isArray(r.subjects) ? r.subjects.join(", ") : text(r.subjects);
          const researchInterests = Array.isArray(r.research_interests)
            ? r.research_interests.join(", ")
            : text(r.research_interests);

          return (
            <div
              key={i}
              style={{
                padding: "16px 20px",
                background: "#ffffff",
                borderRadius: 10,
                border: "1.5px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Header: Name, Department, Designation, Contact */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                    {text(r.name || r.full_name || "Faculty Member")}
                  </div>
                  <div style={{ fontSize: 13, color: "#4f46e5", fontWeight: 600, marginTop: 2 }}>
                    {text(r.designation || "Faculty")} · {text(r.department || "AIML")}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    fontSize: 12,
                    color: "#475569",
                    flexWrap: "wrap",
                  }}
                >
                  {!!r.cabin && (
                    <span style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: 6 }}>
                      📍 {text(r.cabin)}
                    </span>
                  )}
                  {!!r.email && (
                    <span style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: 6 }}>
                      ✉️ {text(r.email)}
                    </span>
                  )}
                  {!!r.phone && (
                    <span style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: 6 }}>
                      📞 {text(r.phone)}
                    </span>
                  )}
                </div>
              </div>

              {/* Grid of structured academic details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 10,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                }}
              >
                {!!r.qualifications && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                    <strong style={{ color: "#334155" }}>🎓 Qualifications: </strong>
                    <span style={{ color: "#475569" }}>{text(r.qualifications)}</span>
                  </div>
                )}
                {!!r.experience && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                    <strong style={{ color: "#334155" }}>💼 Experience: </strong>
                    <span style={{ color: "#475569" }}>{text(r.experience)}</span>
                  </div>
                )}
                {!!subjects && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                    <strong style={{ color: "#334155" }}>📚 Courses Taught: </strong>
                    <span style={{ color: "#475569" }}>{subjects}</span>
                  </div>
                )}
                {!!researchInterests && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                    <strong style={{ color: "#334155" }}>🔬 Research Interests: </strong>
                    <span style={{ color: "#475569" }}>{researchInterests}</span>
                  </div>
                )}
                {!!r.publications && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                    <strong style={{ color: "#334155" }}>📄 Publications & Patents: </strong>
                    <span style={{ color: "#475569" }}>{text(r.publications)}</span>
                  </div>
                )}
                {!!r.projects && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                    <strong style={{ color: "#334155" }}>💡 Projects & Grants: </strong>
                    <span style={{ color: "#475569" }}>{text(r.projects)}</span>
                  </div>
                )}
                {!!r.awards && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                    <strong style={{ color: "#334155" }}>🏆 Awards & Honors: </strong>
                    <span style={{ color: "#475569" }}>{text(r.awards)}</span>
                  </div>
                )}
                {!!r.responsibilities && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                    <strong style={{ color: "#334155" }}>🏛️ Responsibilities: </strong>
                    <span style={{ color: "#475569" }}>{text(r.responsibilities)}</span>
                  </div>
                )}
              </div>

              {/* Bio Summary */}
              {!!bio && bio !== rawDoc && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    📝 Profile Summary:
                  </div>
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: "#334155",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {bio}
                  </div>
                </div>
              )}

              {/* Complete all paragraphs of the PDF */}
              {(!!rawDoc || (!!bio && (!r.qualifications || !r.experience))) && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                    📑 Document Content (All Paragraphs of PDF):
                  </div>
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "12px 16px",
                      fontSize: 12.5,
                      lineHeight: 1.7,
                      color: "#1e293b",
                      whiteSpace: "pre-wrap",
                      maxHeight: 380,
                      overflowY: "auto",
                      fontFamily: "inherit",
                    }}
                  >
                    {rawDoc || bio}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ParagraphPreview({
  records,
  editable = false,
  onChange,
}: {
  records: DataRecord[];
  editable?: boolean;
  onChange?: (next: DataRecord[]) => void;
}) {
  const narrative = records
    .map((r) => {
      if (r.content) return text(r.content);
      if (r.text) return text(r.text);
      if (r.description) return `${text(r.title)}: ${text(r.description)}`;
      if (r.name && r.date) return `• ${text(r.name)} (${text(r.date)})`;
      return Object.entries(r)
        .filter(([k]) => !k.startsWith("_") && k !== "id")
        .map(([k, v]) => `${k.replaceAll("_", " ")}: ${text(v)}`)
        .join(" · ");
    })
    .join("\n\n");

  return (
    <div className="panel" style={{ padding: "18px 22px" }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
          Scanned Document Content (Narrative Paragraph Format)
        </h3>
        <p className="subtle" style={{ fontSize: 12, margin: "2px 0 0" }}>
          Notices, circulars, announcements, and syllabus texts are presented in natural readable paragraphs.
        </p>
      </div>

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "16px 20px",
          fontSize: 13.5,
          lineHeight: 1.7,
          color: "#1e293b",
          whiteSpace: "pre-wrap",
          fontFamily: "inherit",
          maxHeight: 480,
          overflowY: "auto",
        }}
      >
        {narrative || "No paragraph text extracted from document."}
      </div>
    </div>
  );
}

function Members({ w }: { w: Workspace }) {
  const { data, error } = useRemote<DataRecord[]>("/v1/admin/memberships", w);
  const [message, setMessage] = useState("");
  const [fail, setFail] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMatrix, setShowMatrix] = useState(true);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFail("");
    setMessage("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/v1/admin/memberships", w.session, w.tenant, {
        method: "POST",
        body: JSON.stringify({ ...values, semester: Number(values.semester) }),
      });
      setMessage("Role & institution membership successfully saved. Permissions take effect immediately.");
      w.refresh();
    } catch (e) {
      setFail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const roleBadge = (role: unknown) => {
    const r = String(role || "").toLowerCase();
    if (r.includes("institution_admin") || r.includes("platform_admin")) {
      return <span className="badge b-adm">Institution Admin</span>;
    }
    if (r.includes("department_admin")) {
      return <span className="badge b-adm" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" }}>Dept Admin</span>;
    }
    if (r.includes("faculty")) {
      return <span className="badge" style={{ background: "#f3e8ff", borderColor: "#d8b4fe", color: "#7e22ce" }}>Faculty</span>;
    }
    return <span className="badge b-stu">Student</span>;
  };

  return (
    <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            Role-Based Access Control (RBAC) & Memberships
          </h2>
          <p className="subtle" style={{ margin: "6px 0 0", fontSize: 13 }}>
            Manage campus user roles, assign departmental access, and govern permissions across institutional resources.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowMatrix((prev) => !prev)}
        >
          {showMatrix ? "Hide Permissions Guide" : "View Permissions Guide"}
        </Button>
      </div>

      {showMatrix && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "16px 18px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ background: "#fff", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className="badge b-stu">Student</span>
            </div>
            <p className="subtle" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
              Read-only personal timetable, budget canteen finder, campus circulars, personal schedule check-in.
            </p>
          </div>
          <div style={{ background: "#fff", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className="badge" style={{ background: "#f3e8ff", borderColor: "#d8b4fe", color: "#7e22ce" }}>Faculty</span>
            </div>
            <p className="subtle" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
              Faculty directory profile with courses taught, research interests, publications, and teaching timetable.
            </p>
          </div>
          <div style={{ background: "#fff", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className="badge b-adm">Dept Admin</span>
            </div>
            <p className="subtle" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
              Upload and manage departmental timetables, edit slot allocations, manage canteen menus and notices.
            </p>
          </div>
          <div style={{ background: "#fff", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className="badge b-adm" style={{ fontWeight: 800 }}>Institution Admin</span>
            </div>
            <p className="subtle" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
              Full administrative authority: vision ingestion, role assignment, system telemetry, audit trail, and settings.
            </p>
          </div>
        </div>
      )}

      <ErrorBox message={error || fail} />
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}

      {/* Role Assignment Form */}
      <div style={{ background: "rgba(255, 255, 255, 0.7)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "var(--foreground)" }}>
          Assign Role & Member Details
        </h3>
        <form onSubmit={save}>
          <div className="upload-grid">
            {[
              ["user_id", "Supabase User ID"],
              ["name", "Full / Preferred Name"],
              ["department", "Department (e.g. CSE, AIML)"],
              ["section", "Section (e.g. A, B)"],
            ].map(([name, label]) => (
              <div key={name}>
                <label htmlFor={name} style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  {label}
                </label>
                <input
                  name={name}
                  id={name}
                  required
                  maxLength={name === "name" ? 120 : 60}
                  placeholder={`Enter ${label.toLowerCase()}`}
                  style={{ borderRadius: 10, fontSize: 13.5 }}
                />
              </div>
            ))}
            <div>
              <label htmlFor="member-role" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                Role Assignment
              </label>
              <select id="member-role" name="role" style={{ borderRadius: 10, fontSize: 13.5 }}>
                <option value="student">Student (Standard Access)</option>
                <option value="faculty">Faculty (Academic Directory & Teaching)</option>
                <option value="department_admin">Department Administrator</option>
                <option value="institution_admin">Institution Administrator (Full RBAC)</option>
              </select>
            </div>
            <div>
              <label htmlFor="semester" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                Semester
              </label>
              <input
                id="semester"
                name="semester"
                type="number"
                min={1}
                max={12}
                defaultValue={3}
                style={{ borderRadius: 10, fontSize: 13.5 }}
              />
            </div>
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center" }}>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving Permissions…" : "Assign Role & Save Membership"}
            </Button>
            <span className="subtle" style={{ fontSize: 12 }}>
              Requires existing user identity in authentication provider.
            </span>
          </div>
        </form>
      </div>

      {/* Active Members & Roles Roster */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Active Campus Members ({data?.length ?? 0})
          </h3>
          <span className="subtle" style={{ fontSize: 12 }}>
            Real-time permissions roster
          </span>
        </div>
        {data && data.length > 0 ? (
          <div className="data-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Name</th>
                  <th style={{ textAlign: "left" }}>Assigned Role</th>
                  <th style={{ textAlign: "left" }}>Department</th>
                  <th style={{ textAlign: "center" }}>Section</th>
                  <th style={{ textAlign: "center" }}>Semester</th>
                  <th style={{ textAlign: "left" }}>User ID</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: "var(--foreground)" }}>{text(r.name) || "—"}</td>
                    <td>{roleBadge(r.role)}</td>
                    <td style={{ fontWeight: 600, color: "#475569" }}>{text(r.department) || "All"}</td>
                    <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12 }}>{text(r.section) || "—"}</td>
                    <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12 }}>{text(r.semester) || "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748b" }}>{text(r.user_id || r.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty message="No memberships enrolled yet." hint="Use the form above to assign institutional roles to users." />
        )}
      </div>
    </section>
  );
}
