"use client";
import { useState } from "react";
import { Clock3, CalendarDays } from "lucide-react";
import {
  type Workspace,
  type Page,
  useRemote,
  ErrorBox,
  Loading,
} from "@/components/campus-app";
import { api, type DataRecord, campusDate, prettyDate } from "@/lib/api";
import {
  RecordList,
  Empty,
  RecordCard,
} from "@/components/result-cards";
import { TimetableCardTable } from "@/components/timetable-card-table";
import { Button } from "@/components/ui/button";

const descriptions: Partial<Record<Page, string>> = {
  Timetable: "Know where to be, and what comes next.",
  Canteen: "Good food. A budget that works for you.",
  Notices: "The campus updates that matter to you.",
  Events: "Find your next idea, connection, or opportunity.",
  Faculty: "Find the right person, without the runaround.",
  Calendar: "A little more room for everything you do.",
};

const TIMETABLE_DAYS = [
  { id: "all", label: "All Days (Grid)" },
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
];

export function BrowseView({ w, page }: { w: Workspace; page: Page }) {
  const [date, setDate] = useState(campusDate(w.profile.timezone));
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState(100);
  const [diet, setDiet] = useState(
    w.profile.diet === "vegetarian" ? "true" : "any",
  );
  const [sort, setSort] = useState("price");
  const [tab, setTab] = useState("all");
  const [archive, setArchive] = useState(false);
  const [editError, setEditError] = useState("");
  const isAdmin = [
    "institution_admin",
    "department_admin",
    "platform_admin",
  ].includes(w.profile.role);

  let path = "/v1/notices";
  let kind = "notices";
  const params = new URLSearchParams();
  if (page === "Timetable") {
    params.set("on", date);
    params.set("week", "true");
    path = "/v1/timetable";
    kind = "classes";
  } else if (page === "Canteen") {
    params.set("budget", String(budget));
    if (diet !== "any") params.set("vegetarian", diet);
    if (tab === "meals") {
      path = "/v1/meals";
      kind = "meals";
    } else {
      path = "/v1/menu";
      kind = "food";
      params.set("query", query);
      params.set("sort", sort);
    }
  } else if (page === "Faculty") {
    path = "/v1/faculty";
    kind = "faculty";
    params.set("query", query);
  } else if (page === "Notices") {
    params.set("query", query);
    params.set("include_outdated", String(archive));
  } else if (page === "Events") {
    path = "/v1/events";
    kind = "events";
    params.set("start", date);
    params.set("query", query);
  } else if (page === "Calendar") {
    path = "/v1/calendar";
    params.set("start", date);
    params.set("days", "7");
  }
  const { data, error, loading } = useRemote<
    | DataRecord[]
    | {
        classes: DataRecord[];
        events: DataRecord[];
        free_slots: DataRecord[];
        conflicts: DataRecord[];
      }
  >(path + "?" + params, w);
  const rows = Array.isArray(data) ? data : [];

  async function handleSaveSlot(id: string, updated: Record<string, unknown>) {
    setEditError("");
    try {
      await api(`/v1/timetable/${id}`, w.session, w.tenant, {
        method: "PATCH",
        body: JSON.stringify(updated),
      });
      w.refresh();
    } catch (e) {
      setEditError((e as Error).message);
    }
  }

  async function handleDeleteSlot(id: string) {
    setEditError("");
    try {
      await api(`/v1/timetable/${id}`, w.session, w.tenant, {
        method: "DELETE",
      });
      w.refresh();
    } catch (e) {
      setEditError((e as Error).message);
    }
  }

  async function handleCreateSlot(created: Record<string, unknown>) {
    setEditError("");
    try {
      await api("/v1/timetable", w.session, w.tenant, {
        method: "POST",
        body: JSON.stringify(created),
      });
      w.refresh();
    } catch (e) {
      setEditError((e as Error).message);
    }
  }

  const [editingFaculty, setEditingFaculty] = useState<DataRecord | null>(null);
  const [facultyDraft, setFacultyDraft] = useState({
    name: "",
    designation: "",
    department: "",
    email: "",
    cabin: "",
    office_hours: "",
    qualifications: "",
    experience: "",
    subjects: "",
    research_interests: "",
    bio: "",
  });
  const [savingFaculty, setSavingFaculty] = useState(false);
  const [facultySuccess, setFacultySuccess] = useState("");

  function openFacultyEdit(fac: DataRecord) {
    setEditingFaculty(fac);
    setFacultyDraft({
      name: String(fac.name || fac.full_name || ""),
      designation: String(fac.designation || ""),
      department: String(fac.department || fac.branch || ""),
      email: String(fac.email || ""),
      cabin: String(fac.office || fac.cabin || ""),
      office_hours: String(fac.office_hours || ""),
      qualifications: String(fac.qualifications || ""),
      experience: String(fac.experience || ""),
      subjects: Array.isArray(fac.subjects) ? fac.subjects.join(", ") : String(fac.subjects || ""),
      research_interests: Array.isArray(fac.research_interests) ? fac.research_interests.join(", ") : String(fac.research_interests || ""),
      bio: String(fac.bio || ""),
    });
    setEditError("");
    setFacultySuccess("");
  }

  async function handleSaveFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (!editingFaculty) return;
    setSavingFaculty(true);
    setEditError("");
    const fid = String(editingFaculty.id || editingFaculty.code || editingFaculty.name);
    try {
      await api(`/v1/faculty/${encodeURIComponent(fid)}`, w.session, w.tenant, {
        method: "PATCH",
        body: JSON.stringify(facultyDraft),
      });
      setFacultySuccess(`Updated "${facultyDraft.name}" successfully`);
      setTimeout(() => {
        setEditingFaculty(null);
        w.refresh();
      }, 500);
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSavingFaculty(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR CAMPUS, A LITTLE CLOSER</div>
          <h1>{page}</h1>
          <p>{descriptions[page]}</p>
        </div>
        <div className="date-label">
          {w.profile.department} · Sem {w.profile.semester} ·{" "}
          {w.profile.section}
        </div>
      </div>
      {page === "Canteen" && (
        <div className="tabs" aria-label="Menu view">
          <button aria-pressed={tab !== "meals"} onClick={() => setTab("day")}>
            Browse menu
          </button>
          <button
            aria-pressed={tab === "meals"}
            onClick={() => setTab("meals")}
          >
            Meal combinations
          </button>
        </div>
      )}
      <div className="filters">
        {["Calendar", "Events"].includes(page) && (
          <div className="filter-field small">
            <label htmlFor="date">
              {page === "Calendar" ? "Week starting" : "Date"}
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
        )}
        {["Notices", "Faculty", "Events"].includes(page) ||
        (page === "Canteen" && tab !== "meals") ? (
          <div className="filter-field">
            <label htmlFor="search">Search {page.toLowerCase()}</label>
            <input
              id="search"
              placeholder={
                page === "Faculty"
                  ? "Name, subject or department"
                  : page === "Events"
                    ? "AI, workshop, technical…"
                    : "Search by name or topic…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={200}
            />
          </div>
        ) : null}
        {page === "Canteen" && (
          <>
            <div className="filter-field small">
              <label htmlFor="budget">Maximum budget (₹)</label>
              <input
                id="budget"
                type="number"
                min={0}
                max={10000}
                value={budget}
                onChange={(e) =>
                  setBudget(
                    Math.min(10000, Math.max(0, Number(e.target.value))),
                  )
                }
              />
            </div>
            <div className="filter-field small">
              <label htmlFor="diet">Dietary preference</label>
              <select
                id="diet"
                value={diet}
                onChange={(e) => setDiet(e.target.value)}
              >
                <option value="any">All food</option>
                <option value="true">Vegetarian</option>
                <option value="false">Non-vegetarian</option>
              </select>
            </div>
            {tab !== "meals" && (
              <div className="filter-field small">
                <label htmlFor="sort">Sort by</label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="price">Lowest price</option>
                  <option value="protein">Most protein</option>
                </select>
              </div>
            )}
          </>
        )}
        {page === "Notices" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              margin: 0,
              minHeight: 44,
            }}
          >
            <input
              type="checkbox"
              checked={archive}
              onChange={(e) => setArchive(e.target.checked)}
            />
            Include archived notices
          </label>
        )}
        <Button variant="outline" onClick={w.refresh}>
          Refresh
        </Button>
      </div>
      <ErrorBox message={error || editError} />
      {loading ? (
        <Loading />
      ) : page === "Calendar" && data && !Array.isArray(data) ? (
        <>
          <section className="panel" style={{ marginBottom: 24 }}>
            <div className="panel-heading">
              <h2>
                <Clock3 size={16} />
                Room in your day · {prettyDate(date)}
              </h2>
            </div>
            <RecordList records={data.free_slots} kind="slots" limit={3} />
          </section>
          <WeekGrid
            records={[...data.classes, ...data.events]}
            date={date}
            onSource={w.download}
          />
          <section className="section-gap">
            <h2 style={{ marginBottom: 15 }}>Schedule overlaps</h2>
            {data.conflicts.length ? (
              <RecordList records={data.conflicts} kind="conflicts" limit={3} />
            ) : (
              <Empty
                message="Your schedule is clear"
                hint="No overlaps among the listed classes and activities."
              />
            )}
          </section>
        </>
      ) : page === "Timetable" ? (
        <TimetableCardTable
          records={rows}
          editable={isAdmin}
          onSaveSlot={handleSaveSlot}
          onDeleteSlot={handleDeleteSlot}
          onCreateSlot={handleCreateSlot}
        />
      ) : (
        <>
          <div className="section-header">
            <p>
              {rows.length} result{rows.length === 1 ? "" : "s"}
              {page === "Canteen" ? " · Available items only" : ""}
            </p>
            {page === "Events" && (
              <span className="subtle">
                <CalendarDays
                  size={13}
                  style={{ display: "inline", marginRight: 6 }}
                />
                {prettyDate(date)}
              </span>
            )}
          </div>
          <RecordList
            records={rows}
            kind={kind}
            onSource={w.download}
            onEdit={page === "Faculty" && isAdmin ? (r) => openFacultyEdit(r) : undefined}
            limit={page === "Canteen" ? 12 : 8}
          />
          {page === "Canteen" && (
            <p className="subtle" style={{ marginTop: 20 }}>
              Nutritional values are estimates unless marked verified. Ask the
              vendor about ingredients and allergens. Combinations use distinct
              available items.
            </p>
          )}
        </>
      )}

      {/* Admin Faculty Correction Modal */}
      {editingFaculty && (
        <div className="ov on" style={{ zIndex: 100, display: "flex", padding: 20, alignItems: "center" }}>
          <div
            className="card"
            style={{
              width: "min(680px, 94vw)",
              maxHeight: "88vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 25px 60px rgba(15, 23, 42, 0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span className="badge b-adm" style={{ marginBottom: 6 }}>Admin Faculty Correction</span>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                  Edit Faculty Profile: {facultyDraft.name || "Faculty Member"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingFaculty(null)}
                style={{ background: "none", border: 0, fontSize: 20, cursor: "pointer", color: "var(--muted)" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <ErrorBox message={editError} />
            {facultySuccess && (
              <div className="success" role="status" style={{ marginBottom: 14 }}>
                {facultySuccess}
              </div>
            )}

            <form onSubmit={handleSaveFaculty} style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Full Name</label>
                  <input
                    className="field"
                    value={facultyDraft.name}
                    onChange={(e) => setFacultyDraft({ ...facultyDraft, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Designation</label>
                  <input
                    className="field"
                    value={facultyDraft.designation}
                    onChange={(e) => setFacultyDraft({ ...facultyDraft, designation: e.target.value })}
                    placeholder="e.g. Associate Professor"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Department</label>
                  <input
                    className="field"
                    value={facultyDraft.department}
                    onChange={(e) => setFacultyDraft({ ...facultyDraft, department: e.target.value })}
                    placeholder="e.g. AIML / CSE"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email</label>
                  <input
                    className="field"
                    type="email"
                    value={facultyDraft.email}
                    onChange={(e) => setFacultyDraft({ ...facultyDraft, email: e.target.value })}
                    placeholder="e.g. vijayalakshmi@rvce.edu.in"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Cabin / Office Location</label>
                  <input
                    className="field"
                    value={facultyDraft.cabin}
                    onChange={(e) => setFacultyDraft({ ...facultyDraft, cabin: e.target.value })}
                    placeholder="e.g. Faculty Room 204, Block B"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Office Hours</label>
                  <input
                    className="field"
                    value={facultyDraft.office_hours}
                    onChange={(e) => setFacultyDraft({ ...facultyDraft, office_hours: e.target.value })}
                    placeholder="e.g. Mon-Fri 10:00 - 16:00"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Qualifications</label>
                <input
                  className="field"
                  value={facultyDraft.qualifications}
                  onChange={(e) => setFacultyDraft({ ...facultyDraft, qualifications: e.target.value })}
                  placeholder="e.g. Ph.D. in Computer Science, MCA"
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Experience</label>
                <textarea
                  className="field"
                  rows={2}
                  value={facultyDraft.experience}
                  onChange={(e) => setFacultyDraft({ ...facultyDraft, experience: e.target.value })}
                  placeholder="e.g. Over 25 years of teaching and research experience..."
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Subjects / Courses Taught</label>
                <input
                  className="field"
                  value={facultyDraft.subjects}
                  onChange={(e) => setFacultyDraft({ ...facultyDraft, subjects: e.target.value })}
                  placeholder="e.g. DBMS, Natural Language Processing, AI"
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Research Interests (comma separated)</label>
                <input
                  className="field"
                  value={facultyDraft.research_interests}
                  onChange={(e) => setFacultyDraft({ ...facultyDraft, research_interests: e.target.value })}
                  placeholder="e.g. Data Mining, Machine Learning, Deep Learning"
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Profile Summary / Bio</label>
                <textarea
                  className="field"
                  rows={3}
                  value={facultyDraft.bio}
                  onChange={(e) => setFacultyDraft({ ...facultyDraft, bio: e.target.value })}
                  placeholder="Brief academic biography..."
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <Button type="button" variant="outline" onClick={() => setEditingFaculty(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingFaculty}>
                  {savingFaculty ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function WeekGrid({
  records,
  date,
  onSource,
}: {
  records: DataRecord[];
  date: string;
  onSource: (id: string) => void;
}) {
  const start = new Date(date + "T12:00:00");
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  return (
    <div className="calendar-grid">
      {dates.map((d, dayIndex) => {
        const rows = records.filter((r) => {
          if (String(r.start || r.date).startsWith(d)) return true;
          if (r.day !== undefined && r.day !== null) {
            const dNum = Number(r.day);
            if (dNum === dayIndex + 1) return true;
          }
          return false;
        });
        return (
          <section key={d} className="calendar-day" aria-label={prettyDate(d)}>
            <h3>{prettyDate(d)}</h3>
            {rows.length ? (
              rows.map((r, i) => (
                <RecordCard
                  key={String(r.id) || i}
                  record={r}
                  kind={r.subject ? "classes" : "events"}
                  onSource={onSource}
                />
              ))
            ) : (
              <p className="subtle">No listed activities</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
