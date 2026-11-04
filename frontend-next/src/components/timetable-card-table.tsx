"use client";

import { useState } from "react";
import {
  Clock3,
  MapPin,
  UserRound,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Sparkles,
  LayoutGrid,
  List,
} from "lucide-react";
import { type DataRecord, text } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DAY_NAMES,
  TIMETABLE_TIME_SLOTS,
  enrichTimetableSlot,
  normalizeDay,
  normalizeDayNumber,
} from "@/lib/timetable-legend";

export interface TimetableCardItem {
  id: string;
  day: string;
  day_num: number;
  start_time: string;
  end_time: string;
  subject: string;
  subject_name: string;
  kind: string;
  short_code: string;
  faculty_name: string;
  room: string;
  raw?: DataRecord;
}

export function TimetableCardTable({
  records,
  editable = false,
  onChange,
  onSaveSlot,
  onDeleteSlot,
  onCreateSlot,
}: {
  records: DataRecord[];
  editable?: boolean;
  onChange?: (updated: DataRecord[]) => void;
  onSaveSlot?: (id: string, updated: Record<string, unknown>) => Promise<void>;
  onDeleteSlot?: (id: string) => Promise<void>;
  onCreateSlot?: (created: Record<string, unknown>) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeDayFilter, setActiveDayFilter] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<TimetableCardItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state for editing or creating
  const [formDraft, setFormDraft] = useState({
    day: "Monday",
    start_time: "09:00",
    end_time: "10:00",
    subject: "",
    subject_name: "",
    kind: "lecture",
    short_code: "",
    faculty_name: "",
    room: "CS-301",
  });

  // Enrich raw records so days, teacher initials, and classrooms/labs are ALWAYS populated
  const rawList: (TimetableCardItem | null)[] = records.map((r, idx) => {
    const enriched = enrichTimetableSlot(r as Record<string, unknown>);
    const subj = text(enriched.subject).trim();
    if (!subj || ["null", "none", "break", "lunch", "lunch break"].includes(subj.toLowerCase())) {
      return null;
    }
    const item: TimetableCardItem = {
      id: text(r.id) || `slot-${idx}`,
      day: enriched.day,
      day_num: enriched.day_num,
      start_time: enriched.start_time,
      end_time: enriched.end_time,
      subject: enriched.subject,
      subject_name: enriched.subject_name,
      kind: enriched.kind,
      short_code: enriched.short_code,
      faculty_name: enriched.faculty_name,
      room: enriched.room,
      raw: r,
    };
    return item;
  });

  const enrichedItems: TimetableCardItem[] = rawList
    .filter((x): x is TimetableCardItem => x !== null)
    .sort((a, b) => {
      if (a.day_num !== b.day_num) return a.day_num - b.day_num;
      return a.start_time.localeCompare(b.start_time);
    });

  const weekdays = DAY_NAMES.slice(0, 6); // Monday to Saturday

  // Grid columns come from the extracted data (each distinct start time), NOT a hardcoded list.
  // A fixed list silently hid every slot whose times didn't match it exactly, so a correctly
  // read timetable looked empty. Falls back to the default columns only when there are no slots.
  const timeSlots: string[] = (() => {
    const endByStart = new Map<string, string>();
    for (const it of enrichedItems) {
      const cur = endByStart.get(it.start_time);
      if (!cur || it.end_time < cur) endByStart.set(it.start_time, it.end_time);
    }
    if (endByStart.size === 0) return TIMETABLE_TIME_SLOTS;
    return Array.from(endByStart.keys())
      .sort()
      .map((st) => `${st}–${endByStart.get(st)}`);
  })();

  const filteredItems =
    activeDayFilter === "all"
      ? enrichedItems
      : enrichedItems.filter(
          (item) => item.day.toLowerCase() === activeDayFilter.toLowerCase(),
        );

  function openEdit(item: TimetableCardItem) {
    setEditingItem(item);
    setFormDraft({
      day: item.day,
      start_time: item.start_time,
      end_time: item.end_time,
      subject: item.subject,
      subject_name: item.subject_name,
      kind: item.kind,
      short_code: item.short_code,
      faculty_name: item.faculty_name,
      room: item.room,
    });
    setIsAddingNew(false);
  }

  function openAddNew(defaultDay = "Monday", defaultTime = "09:00–10:00") {
    const [st, et] = defaultTime.includes("–") ? defaultTime.split("–") : ["09:00", "10:00"];
    setEditingItem(null);
    setFormDraft({
      day: defaultDay,
      start_time: st.trim(),
      end_time: et.trim(),
      subject: "",
      subject_name: "",
      kind: "lecture",
      short_code: "",
      faculty_name: "",
      room: "CS-301",
    });
    setIsAddingNew(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formDraft.subject.trim()) return;

    setBusy(true);
    try {
      const dayNum = normalizeDayNumber(formDraft.day);
      const payload: Record<string, unknown> = {
        day: formDraft.day,
        day_num: dayNum,
        start_time: formDraft.start_time.slice(0, 5),
        end_time: formDraft.end_time.slice(0, 5),
        subject: formDraft.subject.trim(),
        subject_name: formDraft.subject_name.trim() || formDraft.subject.trim(),
        kind: formDraft.kind.toLowerCase().trim(),
        short_code: formDraft.short_code.trim(),
        faculty_name: formDraft.faculty_name.trim(),
        room: formDraft.room.trim() || "CS-301",
      };

      if (editingItem) {
        if (onSaveSlot) {
          await onSaveSlot(editingItem.id, payload);
        } else if (onChange) {
          const updated = records.map((r, idx) => {
            const rid = text(r.id) || `slot-${idx}`;
            if (rid === editingItem.id) {
              return { ...r, ...payload };
            }
            return r;
          });
          onChange(updated);
        }
      } else if (isAddingNew) {
        if (onCreateSlot) {
          await onCreateSlot(payload);
        } else if (onChange) {
          onChange([...records, payload as DataRecord]);
        }
      }

      setEditingItem(null);
      setIsAddingNew(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: TimetableCardItem) {
    if (!confirm(`Delete ${item.subject} (${item.day} ${item.start_time})?`)) return;
    setBusy(true);
    try {
      if (onDeleteSlot) {
        await onDeleteSlot(item.id);
      } else if (onChange) {
        const updated = records.filter((r, idx) => {
          const rid = text(r.id) || `slot-${idx}`;
          return rid !== item.id;
        });
        onChange(updated);
      }
      setEditingItem(null);
    } finally {
      setBusy(false);
    }
  }

  // Find slot that matches given day and time slot
  function findSlot(dayName: string, slotLabel: string): TimetableCardItem | undefined {
    const [slotStart, slotEnd] = slotLabel.split("–");
    // Overlap match: a slot belongs in a column if their time ranges intersect.
    return enrichedItems.find(
      (item) =>
        item.day.toLowerCase() === dayName.toLowerCase() &&
        item.start_time < slotEnd &&
        item.end_time > slotStart,
    );
  }

  // Build Course & Faculty legend from the timetable slots
  const legendMap = new Map<string, { code: string; name: string; faculty: string; room: string }>();
  for (const item of enrichedItems) {
    const code = item.subject.split("—")[0].trim();
    if (!legendMap.has(code)) {
      legendMap.set(code, {
        code,
        name: item.subject_name || item.subject,
        faculty: item.short_code
          ? `${item.short_code}${item.faculty_name && item.faculty_name !== item.short_code ? ` · ${item.faculty_name}` : ""}`
          : item.faculty_name || "—",
        room: item.room || "CS-301",
      });
    }
  }
  const legendRows = Array.from(legendMap.values());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Controls: View Toggle & Day Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="tabs" style={{ margin: 0 }}>
          <button
            type="button"
            aria-pressed={activeDayFilter === "all"}
            onClick={() => setActiveDayFilter("all")}
          >
            All Days (Grid)
          </button>
          {weekdays.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={activeDayFilter.toLowerCase() === d.toLowerCase()}
              onClick={() => setActiveDayFilter(d)}
            >
              {d}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="tabs" style={{ margin: 0 }}>
            <button
              type="button"
              aria-pressed={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
              title="Card Display in Table Form"
            >
              <LayoutGrid size={14} style={{ display: "inline", marginRight: 5 }} />
              Card Grid
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
              title="Structured Table Row List"
            >
              <List size={14} style={{ display: "inline", marginRight: 5 }} />
              Table List
            </button>
          </div>

          {editable && (
            <Button
              type="button"
              size="sm"
              onClick={() => openAddNew(activeDayFilter === "all" ? "Monday" : activeDayFilter)}
            >
              <Plus size={14} /> Add Class Card
            </Button>
          )}
        </div>
      </div>

      {/* VIEW MODE 1: CARD DISPLAY IN TABLE FORM */}
      {viewMode === "grid" ? (
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ borderCollapse: "separate", borderSpacing: "4px" }}>
            <thead>
              <tr>
                <th
                  style={{
                    minWidth: 120,
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "#f1f5f9",
                  }}
                >
                  Day \ Time
                </th>
                {timeSlots.map((sl) => (
                  <th key={sl} style={{ minWidth: 165, textAlign: "center" }}>
                    <div style={{ fontWeight: 700 }}>{sl}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(activeDayFilter === "all" ? weekdays : [activeDayFilter]).map((dayName) => (
                <tr key={dayName}>
                  <td
                    style={{
                      fontWeight: 800,
                      color: "#0f172a",
                      background: "#f8fafc",
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      borderRight: "2px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5 }}>{dayName}</span>
                      <span className="subtle" style={{ fontSize: 10 }}>
                        {enrichedItems.filter((i) => i.day.toLowerCase() === dayName.toLowerCase()).length} classes
                      </span>
                    </div>
                  </td>

                  {timeSlots.map((sl) => {
                    const hit = findSlot(dayName, sl);

                    if (!hit) {
                      return (
                        <td
                          key={sl}
                          style={{
                            background: "#fafafa",
                            borderRadius: 8,
                            padding: "8px",
                            textAlign: "center",
                            verticalAlign: "middle",
                            border: "1px dashed #e2e8f0",
                          }}
                        >
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => openAddNew(dayName, sl)}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "#94a3b8",
                                fontSize: 11,
                                cursor: "pointer",
                                padding: "8px",
                                width: "100%",
                                borderRadius: 6,
                              }}
                              title={`Add slot to ${dayName} ${sl}`}
                            >
                              + Add
                            </button>
                          ) : (
                            <span style={{ color: "#cbd5e1", fontSize: 12 }}>—</span>
                          )}
                        </td>
                      );
                    }

                    const isLab = hit.kind === "lab";

                    return (
                      <td
                        key={sl}
                        style={{
                          background: isLab ? "#f5f3ff" : "#f0f9ff",
                          borderRadius: 10,
                          border: isLab ? "1.5px solid #ddd6fe" : "1.5px solid #bae6fd",
                          padding: "8px 10px",
                          verticalAlign: "top",
                          position: "relative",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* CARD DISPLAY IN TABLE FORM */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                            height: "100%",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            {/* Card Kicker: Time & Type Badge */}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 4,
                                marginBottom: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: "var(--font-mono), monospace",
                                  fontWeight: 600,
                                  color: "#475569",
                                }}
                              >
                                {hit.start_time}–{hit.end_time}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  textTransform: "uppercase",
                                  background: isLab ? "#8b5cf6" : "#0284c7",
                                  color: "#ffffff",
                                  letterSpacing: "0.4px",
                                }}
                              >
                                {isLab ? "Lab" : "Lecture"}
                              </span>
                            </div>

                            {/* Subject Code & Full Title */}
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 13,
                                color: "#0f172a",
                                lineHeight: 1.25,
                              }}
                            >
                              {hit.subject}
                            </div>
                            {hit.subject_name && hit.subject_name !== hit.subject && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#475569",
                                  lineHeight: 1.2,
                                  marginTop: 2,
                                }}
                              >
                                {hit.subject_name}
                              </div>
                            )}
                          </div>

                          {/* Teacher's Initials & Classroom / Lab Room */}
                          <div
                            style={{
                              marginTop: 4,
                              paddingTop: 4,
                              borderTop: isLab ? "1px solid #ede9fe" : "1px solid #e0f2fe",
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            {/* Teacher's Initials */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                color: isLab ? "#6d28d9" : "#0369a1",
                              }}
                              title={hit.faculty_name ? `Faculty: ${hit.faculty_name}` : undefined}
                            >
                              <UserRound size={12} />
                              <span>{hit.short_code ? hit.short_code : hit.faculty_name || "Faculty TBA"}</span>
                            </div>

                            {/* Classroom or Lab */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 10.5,
                                color: "#475569",
                              }}
                            >
                              <MapPin size={11} />
                              <span>{hit.room || (isLab ? "Lab TBA" : "Room TBA")}</span>
                            </div>
                          </div>

                          {/* Edit Option Button for Admin */}
                          {editable && (
                            <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end", gap: 4 }}>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(hit)}
                                style={{
                                  height: 24,
                                  padding: "2px 7px",
                                  fontSize: 11,
                                  borderRadius: 5,
                                }}
                              >
                                <Pencil size={11} style={{ marginRight: 3 }} />
                                Edit
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW MODE 2: STRUCTURED TABLE LIST VIEW */
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Subject Code</th>
                <th>Course Title</th>
                <th>Type</th>
                <th>Teacher's Initials</th>
                <th>Faculty Full Name</th>
                <th>Classroom / Lab</th>
                {editable && <th style={{ width: 100 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 700, color: "#0f172a" }}>{item.day}</td>
                  <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12 }}>
                    {item.start_time} – {item.end_time}
                  </td>
                  <td style={{ fontWeight: 800, color: "#4f46e5" }}>{item.subject}</td>
                  <td style={{ fontSize: 12.5, color: "#1e293b" }}>{item.subject_name || item.subject}</td>
                  <td>
                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "capitalize",
                        background: item.kind === "lab" ? "#f3e8ff" : "#e0f2fe",
                        color: item.kind === "lab" ? "#7e22ce" : "#0369a1",
                      }}
                    >
                      {item.kind}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: "#4338ca" }}>{item.short_code || "—"}</td>
                  <td style={{ fontSize: 12 }}>{item.faculty_name || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{item.room || "CS-301"}</td>
                  {editable && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(item)}
                          style={{ height: 26, padding: "2px 8px" }}
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          style={{ height: 26, padding: "2px 8px" }}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL / DRAWER FOR EDITING OR ADDING A TIMETABLE CARD */}
      {(editingItem || isAddingNew) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => {
            setEditingItem(null);
            setIsAddingNew(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              padding: "24px",
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              border: "1px solid #e2e8f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                  {editingItem ? "Edit Class Card" : "Add New Class Card"}
                </h3>
                <p className="subtle" style={{ margin: "2px 0 0", fontSize: 12 }}>
                  Set day, period, course details, teacher initials, and classroom/lab.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddingNew(false);
                }}
              >
                <X size={16} />
              </Button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Day of Week */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Day of the Week *
                  </label>
                  <select
                    value={formDraft.day}
                    onChange={(e) => setFormDraft({ ...formDraft, day: e.target.value })}
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    {weekdays.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class Type */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Class Type *
                  </label>
                  <select
                    value={formDraft.kind}
                    onChange={(e) => setFormDraft({ ...formDraft, kind: e.target.value })}
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab Session</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="other">Other / Counselling</option>
                  </select>
                </div>

                {/* Start Time */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Start Time (HH:MM) *
                  </label>
                  <input
                    value={formDraft.start_time}
                    onChange={(e) => setFormDraft({ ...formDraft, start_time: e.target.value })}
                    placeholder="09:00"
                    required
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>

                {/* End Time */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    End Time (HH:MM) *
                  </label>
                  <input
                    value={formDraft.end_time}
                    onChange={(e) => setFormDraft({ ...formDraft, end_time: e.target.value })}
                    placeholder="10:00"
                    required
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>

                {/* Subject Code */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Subject Code / Short Name *
                  </label>
                  <input
                    value={formDraft.subject}
                    onChange={(e) => setFormDraft({ ...formDraft, subject: e.target.value })}
                    placeholder="e.g. CS235AT or DSA Lab"
                    required
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>

                {/* Classroom or Lab */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Classroom / Lab Room *
                  </label>
                  <input
                    value={formDraft.room}
                    onChange={(e) => setFormDraft({ ...formDraft, room: e.target.value })}
                    placeholder="e.g. CS-301 or Programming Lab-1"
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>

                {/* Full Course Title */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Full Course Title
                  </label>
                  <input
                    value={formDraft.subject_name}
                    onChange={(e) => setFormDraft({ ...formDraft, subject_name: e.target.value })}
                    placeholder="e.g. Operating Systems"
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>

                {/* Teacher's Initials */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Teacher's Initials (Short Code)
                  </label>
                  <input
                    value={formDraft.short_code}
                    onChange={(e) => setFormDraft({ ...formDraft, short_code: e.target.value })}
                    placeholder="e.g. RKM or SN & KVR"
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>

                {/* Teacher's Full Name */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Course Handling Faculty Name
                  </label>
                  <input
                    value={formDraft.faculty_name}
                    onChange={(e) => setFormDraft({ ...formDraft, faculty_name: e.target.value })}
                    placeholder="e.g. Dr. Rajesh Kumar M"
                    style={{ width: "100%", minHeight: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                {editingItem ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDelete(editingItem)}
                    disabled={busy}
                    style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                  >
                    <Trash2 size={14} /> Delete Card
                  </Button>
                ) : (
                  <div />
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingItem(null);
                      setIsAddingNew(false);
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy || !formDraft.subject.trim()}>
                    <Check size={14} />
                    {editingItem ? "Save Changes" : "Add Slot"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course & Faculty Mapping Legend Table */}
      {legendRows.length > 0 && (
        <div className="panel" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                Course &amp; Faculty Mapping Legend (From Timetable)
              </h3>
              <p className="subtle" style={{ fontSize: 12, margin: "2px 0 0" }}>
                Course codes, subject names, course-handling faculty initials, and classrooms/labs.
              </p>
            </div>
          </div>
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Full Course Name</th>
                  <th>Handling Faculty (Initials &amp; Name)</th>
                  <th>Classroom / Lab</th>
                </tr>
              </thead>
              <tbody>
                {legendRows.map((lr) => (
                  <tr key={lr.code}>
                    <td style={{ fontWeight: 800, fontFamily: "var(--font-mono), monospace", color: "#4f46e5" }}>
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
    </div>
  );
}
