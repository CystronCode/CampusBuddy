"use client";
import { useState } from "react";
import {
  MapPin,
  Clock3,
  UserRound,
  Leaf,
  ExternalLink,
  FileText,
  Check,
  TriangleAlert,
  Mail,
  Pencil,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { type DataRecord, prettyDate, text } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function DemoBadge() {
  return <span className="demo-badge">Demo Data</span>;
}
export function Empty({
  message = "No records yet.",
  hint = "Try another day or ask an administrator to import the relevant source.",
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="empty">
      <FileText size={24} aria-hidden="true" />
      <strong>{message}</strong>
      <p>{hint}</p>
    </div>
  );
}
function asRecord(value: unknown): DataRecord {
  return (value && typeof value === "object" ? value : {}) as DataRecord;
}

export function RecordCard({
  record: r,
  kind,
  onSource,
}: {
  record: DataRecord;
  kind: string;
  onSource?: (id: string) => void;
}) {
  const timeRange = (a: unknown, b: unknown) =>
    `${text(a).includes("T") ? text(a).split("T")[1].slice(0, 5) : text(a).slice(0, 5)} – ${text(b).includes("T") ? text(b).split("T")[1].slice(0, 5) : text(b).slice(0, 5)}`;
  const source = typeof r.source_id === "string" ? r.source_id : undefined;
  let content: React.ReactNode;
  if (kind === "classes")
    content = (
      <>
        <div className="record-kicker">
          {prettyDate(r.date || r.start)}
          <span>{timeRange(r.start_time || r.start, r.end_time || r.end)}</span>
        </div>
        <h3>{text(r.subject)}</h3>
        <div className="record-details">
          <span>
            <MapPin size={14} />
            {text(r.room)}
          </span>
          <span>
            <UserRound size={14} />
            {text(r.faculty || r.faculty_code)}
          </span>
        </div>
      </>
    );
  else if (kind === "food")
    content = (
      <>
        <div className="record-kicker">
          <span className={r.vegetarian ? "veg" : "nonveg"}>
            <Leaf size={13} />
            {r.vegetarian ? "Vegetarian" : "Non-vegetarian"}
          </span>
          <strong className="price">₹{text(r.price)}</strong>
        </div>
        <h3>{text(r.name)}</h3>
        <p>
          {text(r.location)} · {r.available ? "Available" : "Unavailable"}
        </p>
        <div className="nutrition">
          {r.protein !== null && r.protein !== undefined
            ? `${r.protein} g protein`
            : "Protein not supplied"}
          {r.calories !== null && r.calories !== undefined
            ? ` · ${r.calories} kcal`
            : ""}{" "}
          · {r.nutrition_verified ? "Verified" : "Estimated"}
        </div>
      </>
    );
  else if (kind === "faculty") {
    const contactStr = text(r.contact || r.email);
    const researchStr = text(r.research_interests);
    const subjStr = text(r.subjects);
    content = (
      <>
        <div className="record-kicker">
          {text(r.department)} · {text(r.designation)}
          {r.code ? <span>Code: {text(r.code)}</span> : null}
        </div>
        <h3>{text(r.name)}</h3>
        {!!r.qualifications && (
          <p style={{ fontSize: 13, marginTop: 4 }}>
            <strong>Qualifications:</strong> {text(r.qualifications)}
          </p>
        )}
        {!!r.experience && (
          <p style={{ fontSize: 13, marginTop: 4 }}>
            <strong>Experience:</strong> {text(r.experience)}
          </p>
        )}
        {!!subjStr && (
          <p style={{ fontSize: 13, marginTop: 4 }}>
            <strong>Subjects:</strong> {subjStr}
          </p>
        )}
        {!!researchStr && (
          <p style={{ fontSize: 13, marginTop: 4 }}>
            <strong>Research Interests:</strong> {researchStr}
          </p>
        )}
        {!!r.publications && (
          <p style={{ fontSize: 13, marginTop: 4 }}>
            <strong>Publications &amp; Patents:</strong> {text(r.publications)}
          </p>
        )}
        {!!r.projects && (
          <p style={{ fontSize: 13, marginTop: 4 }}>
            <strong>Projects &amp; Guidance:</strong> {text(r.projects)}
          </p>
        )}
        {!!r.awards && (
          <p style={{ fontSize: 13, marginTop: 4 }}>
            <strong>Awards &amp; Memberships:</strong> {text(r.awards)}
          </p>
        )}
        {!!r.responsibilities && (
          <p style={{ fontSize: 13, marginTop: 4 }}>
            <strong>Responsibilities:</strong> {text(r.responsibilities)}
          </p>
        )}
        {!!r.bio && (
          <p className="passage" style={{ fontSize: 13, marginTop: 6 }}>
            {text(r.bio)}
          </p>
        )}
        <div className="record-details" style={{ marginTop: 8 }}>
          <span>
            <MapPin size={14} />
            {text(r.office)}
          </span>
          <span>
            <Clock3 size={14} />
            {text(r.office_hours)}
          </span>
        </div>
        {!!contactStr && (
          <p className="official-contact">
            Official contact: {contactStr}
          </p>
        )}
      </>
    );
  } else if (kind === "events")
    content = (
      <>
        <div className="record-kicker">
          {prettyDate(r.start)}
          <span>{text(r.kind)}</span>
        </div>
        <h3>{text(r.title)}</h3>
        <div className="record-details">
          <span>
            <Clock3 size={14} />
            {timeRange(r.start, r.end)}
          </span>
          <span>
            <MapPin size={14} />
            {text(r.location)}
          </span>
        </div>
        {typeof r.can_attend === "boolean" && (
          <p className={r.can_attend ? "status-good" : "status-warn"}>
            {r.can_attend ? <Check size={14} /> : <TriangleAlert size={14} />}
            {r.can_attend
              ? "Fits your class schedule"
              : "Overlaps with a class"}
          </p>
        )}
        {!!r.registration_url &&
          text(r.registration_url).startsWith("https://") && (
            <a
              className="text-link"
              href={text(r.registration_url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Register <ExternalLink size={14} />
            </a>
          )}
      </>
    );
  else if (kind === "event_fit") {
    const e = asRecord(r.event);
    const clashes = Array.isArray(r.clashes) ? (r.clashes as DataRecord[]) : [];
    content = (
      <>
        <div className="record-kicker">{prettyDate(e.start)}</div>
        <h3>{text(e.title)}</h3>
        <p>
          {timeRange(e.start, e.end)} · {text(e.location)}
        </p>
        <p className={r.can_attend ? "status-good" : "status-warn"}>
          {r.can_attend ? <Check size={16} /> : <TriangleAlert size={16} />}
          {r.can_attend
            ? "You can attend without missing class"
            : "This overlaps with your timetable"}
        </p>
        {clashes.map((cl, i) => (
          <p key={i}>
            {text(cl.subject)} · {timeRange(cl.start, cl.end)} · {text(cl.room)}
          </p>
        ))}
      </>
    );
  } else if (kind === "meals") {
    const items = Array.isArray(r.items) ? (r.items as DataRecord[]) : [];
    content = (
      <>
        <div className="record-kicker">
          Meal combination<strong className="price">₹{text(r.total)}</strong>
        </div>
        <h3>{items.map((item) => text(item.name)).join(" + ")}</h3>
        <p>{items.map((item) => `${item.name}: ₹${item.price}`).join(" · ")}</p>
        <div className="nutrition">
          {text(r.protein)} g estimated protein ·{" "}
          {items.every((item) => item.vegetarian)
            ? "Vegetarian"
            : "Contains non-vegetarian items"}
        </div>
      </>
    );
  } else if (kind === "slots")
    content = (
      <>
        <div className="record-kicker">
          {prettyDate(r.start)}
          <span>{text(r.minutes)} min free</span>
        </div>
        <h3>{timeRange(r.start, r.end)}</h3>
        <p>Clear of your listed classes and visible activities.</p>
      </>
    );
  else if (kind === "conflicts") {
    const a = asRecord(r.first),
      b = asRecord(r.second);
    content = (
      <>
        <div className="record-kicker status-warn">
          <TriangleAlert size={14} />
          Schedule overlap · {prettyDate(a.start)}
        </div>
        <h3>{text(a.subject || a.title)}</h3>
        <p>{timeRange(a.start, a.end)}</p>
        <h3>{text(b.subject || b.title)}</h3>
        <p>{timeRange(b.start, b.end)}</p>
      </>
    );
  } else if (kind === "emails")
    content = (
      <>
        <div className="record-kicker">
          <Mail size={14} />
          {r.unread ? "Unread message" : "Message"}
          <span>{prettyDate(r.received)}</span>
        </div>
        <h3>{text(r.subject)}</h3>
        <p>From {text(r.sender)}</p>
        <p className="passage">{text(r.body)}</p>
        {Array.isArray(r.extracted_dates) && r.extracted_dates.length > 0 && (
          <p>Dates mentioned: {r.extracted_dates.join(", ")}</p>
        )}
      </>
    );
  else if (kind === "passages")
    content = (
      <>
        <div className="record-kicker">
          Page {text(r.page)}
          <span>{r.outdated ? "Archived / expired" : "Source passage"}</span>
        </div>
        <h3>{text(r.title)}</h3>
        <p className="passage">
          {r.suspicious
            ? "Instruction-like content withheld. Inspect the original source to review."
            : text(r.text)}
        </p>
        <p className="subtle">
          Published {prettyDate(r.published)} · Similarity {text(r.score)}{" "}
          (ranking signal)
        </p>
      </>
    );
  else
    content = (
      <>
        <div className="record-kicker">
          {text(r.category || "Campus notice")}
          <span>{prettyDate(r.published)}</span>
        </div>
        <h3>{text(r.title)}</h3>
        {!!r.expires && <p>Expires {prettyDate(r.expires)}</p>}
        {!!r.supersedes_id && <p>Replaces an earlier version.</p>}
      </>
    );
  const nestedDemo = kind === "event_fit" && !!asRecord(r.event).demo;
  return (
    <article
      className={`record-card ${kind === "classes" ? "class-card" : ""}`}
    >
      {content}
      <footer>
        {(r.demo || nestedDemo) && <DemoBadge />}
        {source && onSource && (
          <Button variant="ghost" size="sm" onClick={() => onSource(source)}>
            <FileText size={13} />
            View source
          </Button>
        )}
      </footer>
    </article>
  );
}

const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TimetableTable({
  records,
  selectedDay = "all",
  editable = false,
  onSaveSlot,
  onDeleteSlot,
  onCreateSlot,
}: {
  records: DataRecord[];
  selectedDay?: string;
  editable?: boolean;
  onSaveSlot?: (id: string, updated: Record<string, unknown>) => Promise<void>;
  onDeleteSlot?: (id: string) => Promise<void>;
  onCreateSlot?: (created: Record<string, unknown>) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<Record<string, string>>({
    day: "1",
    start_time: "09:00",
    end_time: "10:00",
    subject: "",
    subject_name: "",
    kind: "lecture",
    faculty_code: "",
    faculty_name: "",
    room: "",
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const valid = records.filter((r) => {
    const s = text(r.subject).trim();
    return s && !["null", "none", "break", "lunch", "lunch break"].includes(s.toLowerCase());
  });
  if (!valid.length && !editable) return <Empty message="No timetable classes scheduled." />;

  // Sort by day (1..7) then start_time
  const sorted = [...valid].sort((a, b) => {
    const da = Number(a.day) || DAY_ORDER[text(a.day_of_week || a.day)] || 1;
    const db = Number(b.day) || DAY_ORDER[text(b.day_of_week || b.day)] || 1;
    if (da !== db) return da - db;
    return text(a.start_time || a.start).localeCompare(text(b.start_time || b.start));
  });

  const filtered =
    selectedDay === "all"
      ? sorted
      : sorted.filter((r) => {
          const dayName =
            text(r.day_of_week) ||
            WEEKDAYS[(Number(r.day) || DAY_ORDER[text(r.day)] || 1) - 1] ||
            "Monday";
          return dayName.toLowerCase() === selectedDay.toLowerCase();
        });

  // Collect distinct time slots for the weekly matrix grid when showing all days
  const defaultSlots = [
    "09:00–10:00",
    "10:00–11:00",
    "11:30–12:30",
    "12:30–13:30",
    "14:30–15:30",
    "15:30–16:30",
  ];

  const matchSlot = (r: DataRecord, slotLabel: string) => {
    const [slotStart, slotEnd] = slotLabel.split("–");
    const st = text(r.start_time || r.start).slice(0, 5);
    const et = text(r.end_time || r.end).slice(0, 5);
    return st <= slotStart && et >= slotEnd;
  };

  function startEdit(r: DataRecord) {
    const id = text(r.id);
    const dayNum =
      Number(r.day) ||
      DAY_ORDER[text(r.day_of_week || r.day)] ||
      1;
    setEditingId(id);
    setEditDraft({
      day: String(dayNum),
      start_time: text(r.start_time || r.start).slice(0, 5),
      end_time: text(r.end_time || r.end).slice(0, 5),
      subject: text(r.code || r.subject_code || r.subject),
      subject_name: text(r.subject_name),
      kind: text(r.kind || "lecture").toLowerCase(),
      faculty_code: text(r.short_code || r.faculty_code),
      faculty_name: text(r.faculty_name || r.faculty),
      room: text(r.room) === "—" || text(r.room) === "Room TBA" ? "" : text(r.room),
    });
  }

  async function saveEdit(id: string) {
    if (!onSaveSlot) return;
    setBusyId(id);
    try {
      await onSaveSlot(id, {
        day: Number(editDraft.day) || 1,
        start_time: editDraft.start_time,
        end_time: editDraft.end_time,
        subject: editDraft.subject,
        subject_name: editDraft.subject_name,
        kind: editDraft.kind,
        faculty_code: editDraft.faculty_code,
        faculty_name: editDraft.faculty_name,
        room: editDraft.room,
      });
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  }

  async function saveNew() {
    if (!onCreateSlot || !newDraft.subject.trim()) return;
    setBusyId("new");
    try {
      await onCreateSlot({
        day: Number(newDraft.day) || 1,
        start_time: newDraft.start_time,
        end_time: newDraft.end_time,
        subject: newDraft.subject,
        subject_name: newDraft.subject_name,
        kind: newDraft.kind,
        faculty_code: newDraft.faculty_code,
        faculty_name: newDraft.faculty_name,
        room: newDraft.room,
      });
      setAddingNew(false);
      setNewDraft({
        day: "1",
        start_time: "09:00",
        end_time: "10:00",
        subject: "",
        subject_name: "",
        kind: "lecture",
        faculty_code: "",
        faculty_name: "",
        room: "",
      });
    } finally {
      setBusyId(null);
    }
  }

  // Build unique Course & Faculty Legend from the timetable records
  const legendMap = new Map<string, { code: string; name: string; faculty: string; room: string }>();
  for (const r of sorted) {
    const code = text(r.code || r.subject_code || r.subject).split("—")[0].trim();
    const sName = text(r.subject_name || r.subject);
    const fac = text(r.faculty || r.faculty_name || r.short_code || r.faculty_code);
    const rm = text(r.room);
    if (code && !legendMap.has(code)) {
      legendMap.set(code, {
        code,
        name: sName !== code ? sName : code,
        faculty: fac && fac !== "Faculty" && fac !== "—" ? fac : "—",
        room: rm && rm !== "Room TBA" && rm !== "—" && rm !== "TBA" ? rm : "—",
      });
    } else if (code && legendMap.has(code)) {
      const prev = legendMap.get(code)!;
      if (prev.faculty === "—" && fac && fac !== "Faculty" && fac !== "—") prev.faculty = fac;
      if (prev.room === "—" && rm && rm !== "Room TBA" && rm !== "—" && rm !== "TBA") prev.room = rm;
    }
  }
  const legendRows = Array.from(legendMap.values());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {selectedDay === "all" && sorted.length > 0 && (
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 110 }}>Day / Time</th>
                {defaultSlots.map((sl) => (
                  <th key={sl} style={{ minWidth: 145 }}>
                    {sl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((dayName, dIdx) => {
                const dayNum = dIdx + 1;
                const dayRows = sorted.filter(
                  (r) =>
                    Number(r.day) === dayNum ||
                    DAY_ORDER[text(r.day_of_week || r.day)] === dayNum ||
                    text(r.day_of_week || r.day).toLowerCase() === dayName.toLowerCase(),
                );
                return (
                  <tr key={dayName}>
                    <td style={{ fontWeight: 700, color: "#0f172a", background: "#f8fafc" }}>
                      {dayName}
                    </td>
                    {defaultSlots.map((sl) => {
                      const hit = dayRows.find((r) => matchSlot(r, sl));
                      if (!hit) {
                        return (
                          <td key={sl} style={{ color: "#94a3b8", fontSize: 12, textAlign: "center" }}>
                            —
                          </td>
                        );
                      }
                      const isLab = text(hit.kind).toLowerCase() === "lab";
                      const room = text(hit.room);
                      const fac = text(hit.faculty || hit.faculty_name || hit.short_code || hit.faculty_code);
                      return (
                        <td key={sl}>
                          <div
                            style={{
                              padding: "7px 9px",
                              borderRadius: 8,
                              background: isLab ? "#eef2ff" : "#f8fafc",
                              border: isLab ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
                              cursor: editable ? "pointer" : "default",
                            }}
                            onClick={() => editable && startEdit(hit)}
                            title={editable ? "Click to edit this class slot" : undefined}
                          >
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0f172a" }}>
                              {text(hit.subject)}
                            </div>
                            <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 600, marginTop: 2 }}>
                              {fac && fac !== "Faculty" && fac !== "—" ? `Faculty: ${fac}` : isLab ? "Lab Session" : "Lecture"}
                            </div>
                            {room && room !== "Room TBA" && room !== "—" && room !== "TBA" && (
                              <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}>
                                Room: {room}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Course & Faculty Mapping Legend Table */}
      {legendRows.length > 0 && (
        <div className="panel" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                Course &amp; Faculty Mapping (From Timetable)
              </h3>
              <p className="subtle" style={{ fontSize: 12, margin: "2px 0 0" }}>
                Subject codes, full course titles, and course-handling faculty initials/names.
              </p>
            </div>
          </div>
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course / Subject Title</th>
                  <th>Handling Faculty (Initials &amp; Name)</th>
                  <th>Room / Lab</th>
                </tr>
              </thead>
              <tbody>
                {legendRows.map((lr) => (
                  <tr key={lr.code}>
                    <td style={{ fontWeight: 700, fontFamily: "var(--font-mono), monospace", color: "#4f46e5" }}>
                      {lr.code}
                    </td>
                    <td style={{ fontWeight: 600, color: "#0f172a" }}>{lr.name}</td>
                    <td style={{ fontWeight: 600, color: "#1e293b" }}>{lr.faculty}</td>
                    <td>{lr.room}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Schedule Table with Admin Inline Edit Option */}
      <div className="panel" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
              Detailed Class Schedule ({filtered.length} slots)
            </h3>
            <p className="subtle" style={{ fontSize: 12, margin: "2px 0 0" }}>
              {editable
                ? "Admin mode: Click Edit on any row to update Day, Time, Course, Faculty Initials/Name, or Room."
                : "Complete day-by-day class schedule."}
            </p>
          </div>
          {editable && onCreateSlot && (
            <Button size="sm" onClick={() => setAddingNew((v) => !v)}>
              <Plus size={14} />
              {addingNew ? "Cancel new slot" : "Add class slot"}
            </Button>
          )}
        </div>

        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Subject Code &amp; Course</th>
                <th>Type</th>
                <th>Faculty Initials &amp; Name</th>
                <th>Room / Lab</th>
                {editable && <th style={{ width: 130 }}>Admin Actions</th>}
              </tr>
            </thead>
            <tbody>
              {addingNew && editable && (
                <tr style={{ background: "#eef2ff" }}>
                  <td>
                    <select
                      value={newDraft.day}
                      onChange={(e) => setNewDraft({ ...newDraft, day: e.target.value })}
                      style={{ minHeight: 32, padding: "4px 8px", fontSize: 12 }}
                    >
                      {WEEKDAYS.map((d, idx) => (
                        <option key={d} value={String(idx + 1)}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input
                        value={newDraft.start_time}
                        onChange={(e) => setNewDraft({ ...newDraft, start_time: e.target.value })}
                        placeholder="09:00"
                        style={{ width: 64, minHeight: 32, padding: "4px 6px", fontSize: 12 }}
                      />
                      <span>–</span>
                      <input
                        value={newDraft.end_time}
                        onChange={(e) => setNewDraft({ ...newDraft, end_time: e.target.value })}
                        placeholder="10:00"
                        style={{ width: 64, minHeight: 32, padding: "4px 6px", fontSize: 12 }}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <input
                        value={newDraft.subject}
                        onChange={(e) => setNewDraft({ ...newDraft, subject: e.target.value })}
                        placeholder="Code (e.g. CS235AT)"
                        style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                      />
                      <input
                        value={newDraft.subject_name}
                        onChange={(e) => setNewDraft({ ...newDraft, subject_name: e.target.value })}
                        placeholder="Full Course Title"
                        style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                      />
                    </div>
                  </td>
                  <td>
                    <select
                      value={newDraft.kind}
                      onChange={(e) => setNewDraft({ ...newDraft, kind: e.target.value })}
                      style={{ minHeight: 32, padding: "4px 8px", fontSize: 12 }}
                    >
                      <option value="lecture">Lecture</option>
                      <option value="lab">Lab</option>
                      <option value="tutorial">Tutorial</option>
                      <option value="other">Other</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <input
                        value={newDraft.faculty_code}
                        onChange={(e) => setNewDraft({ ...newDraft, faculty_code: e.target.value })}
                        placeholder="Initials (e.g. SN)"
                        style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                      />
                      <input
                        value={newDraft.faculty_name}
                        onChange={(e) => setNewDraft({ ...newDraft, faculty_name: e.target.value })}
                        placeholder="Faculty Full Name"
                        style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      value={newDraft.room}
                      onChange={(e) => setNewDraft({ ...newDraft, room: e.target.value })}
                      placeholder="Room / Lab"
                      style={{ width: 95, minHeight: 32, padding: "4px 8px", fontSize: 12 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button size="sm" onClick={saveNew} disabled={busyId === "new"}>
                        <Check size={13} /> Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAddingNew(false)}>
                        <X size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => {
                const id = text(r.id) || String(i);
                const isEditing = editingId === id;
                const dayName =
                  text(r.day_of_week) ||
                  WEEKDAYS[(Number(r.day) || DAY_ORDER[text(r.day)] || 1) - 1] ||
                  "Monday";
                const st = text(r.start_time || r.start).slice(0, 5);
                const et = text(r.end_time || r.end).slice(0, 5);
                const kindStr = text(r.kind || "lecture");
                const room = text(r.room);
                const fac = text(r.faculty || r.faculty_name || r.short_code || r.faculty_code);

                if (isEditing && editable) {
                  return (
                    <tr key={id} style={{ background: "#f8fafc" }}>
                      <td>
                        <select
                          value={editDraft.day}
                          onChange={(e) => setEditDraft({ ...editDraft, day: e.target.value })}
                          style={{ minHeight: 32, padding: "4px 8px", fontSize: 12 }}
                        >
                          {WEEKDAYS.map((d, idx) => (
                            <option key={d} value={String(idx + 1)}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input
                            value={editDraft.start_time}
                            onChange={(e) => setEditDraft({ ...editDraft, start_time: e.target.value })}
                            style={{ width: 64, minHeight: 32, padding: "4px 6px", fontSize: 12 }}
                          />
                          <span>–</span>
                          <input
                            value={editDraft.end_time}
                            onChange={(e) => setEditDraft({ ...editDraft, end_time: e.target.value })}
                            style={{ width: 64, minHeight: 32, padding: "4px 6px", fontSize: 12 }}
                          />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <input
                            value={editDraft.subject}
                            onChange={(e) => setEditDraft({ ...editDraft, subject: e.target.value })}
                            placeholder="Subject Code"
                            style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                          />
                          <input
                            value={editDraft.subject_name}
                            onChange={(e) => setEditDraft({ ...editDraft, subject_name: e.target.value })}
                            placeholder="Course Name"
                            style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                          />
                        </div>
                      </td>
                      <td>
                        <select
                          value={editDraft.kind}
                          onChange={(e) => setEditDraft({ ...editDraft, kind: e.target.value })}
                          style={{ minHeight: 32, padding: "4px 8px", fontSize: 12 }}
                        >
                          <option value="lecture">Lecture</option>
                          <option value="lab">Lab</option>
                          <option value="tutorial">Tutorial</option>
                          <option value="other">Other</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <input
                            value={editDraft.faculty_code}
                            onChange={(e) => setEditDraft({ ...editDraft, faculty_code: e.target.value })}
                            placeholder="Faculty Initials"
                            style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                          />
                          <input
                            value={editDraft.faculty_name}
                            onChange={(e) => setEditDraft({ ...editDraft, faculty_name: e.target.value })}
                            placeholder="Faculty Name"
                            style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          value={editDraft.room}
                          onChange={(e) => setEditDraft({ ...editDraft, room: e.target.value })}
                          placeholder="Room"
                          style={{ width: 95, minHeight: 32, padding: "4px 8px", fontSize: 12 }}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button size="sm" onClick={() => saveEdit(id)} disabled={busyId === id}>
                            <Check size={13} /> Save
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                            <X size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={id}>
                    <td style={{ fontWeight: 600 }}>{dayName}</td>
                    <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12.5 }}>
                      {st} – {et}
                    </td>
                    <td style={{ fontWeight: 700, color: "#0f172a" }}>{text(r.subject)}</td>
                    <td>
                      <span className="pill" style={{ textTransform: "capitalize" }}>
                        {kindStr}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: "#334155" }}>
                      {fac && fac !== "Faculty" ? fac : "—"}
                    </td>
                    <td>{room && room !== "Room TBA" && room !== "TBA" ? room : "—"}</td>
                    {editable && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button variant="outline" size="sm" onClick={() => startEdit(r)}>
                            <Pencil size={12} /> Edit
                          </Button>
                          {onDeleteSlot && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteSlot(id)}
                              disabled={busyId === id}
                            >
                              <Trash2 size={12} />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function RecordList({
  records,
  kind,
  onSource,
  limit = 8,
}: {
  records: DataRecord[];
  kind: string;
  onSource?: (id: string) => void;
  limit?: number;
}) {
  if (!records.length) return <Empty />;
  if (kind === "classes") {
    return <TimetableTable records={records} selectedDay="all" />;
  }
  return (
    <>
      <div className={`record-list ${kind === "food" ? "food-grid" : ""}`}>
        {records.slice(0, limit).map((r, i) => (
          <RecordCard
            key={text(r.id) || i}
            record={r}
            kind={kind}
            onSource={onSource}
          />
        ))}
      </div>
      {records.length > limit && (
        <details className="more-results">
          <summary>Show {records.length - limit} more results</summary>
          <div className="record-list">
            {records.slice(limit).map((r, i) => (
              <RecordCard
                key={text(r.id) || i}
                record={r}
                kind={kind}
                onSource={onSource}
              />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
