"use client";
import { useState, useEffect, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GraduationCap,
  Home,
  MessagesSquare,
  CalendarDays,
  Utensils,
  FileText,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Code2,
  Search,
  Sparkles,
  ArrowUpRight,
  Clock3,
  MapPin,
  UserRound,
  ArrowRight,
  BookOpen,
  LoaderCircle,
  TriangleAlert,
  Settings,
  Users,
  Compass,
} from "lucide-react";
import {
  supabase,
  api,
  API,
  campusDate,
  prettyDate,
  text,
  type Profile,
  type Membership,
  type Overview,
  type DataRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Empty, DemoBadge } from "@/components/result-cards";
import { ChatView } from "@/components/chat-view";
import { BrowseView } from "@/components/browse-view";
import { AdminView } from "@/components/admin-view";
import { SettingsView } from "@/components/settings-view";

export type Page =
  | "Home"
  | "Ask CampusOS"
  | "Timetable"
  | "Canteen"
  | "Notices"
  | "Events"
  | "Faculty"
  | "Calendar"
  | "Settings"
  | "Admin Console"
  | "System Intelligence";
export interface Workspace {
  session: Session;
  tenant: string;
  profile: Profile;
  download: (id: string) => void;
  refresh: () => void;
  revision: number;
}

export function useRemote<T>(
  path: string,
  w: Pick<Workspace, "session" | "tenant" | "revision">,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setData(null);
    setError("");
    api<T>(path, w.session, w.tenant)
      .then((value) => {
        if (live) setData(value);
      })
      .catch((e) => {
        if (live)
          setError(e instanceof Error ? e.message : "Could not load data.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, w.session, w.tenant, w.revision]);
  return { data, error, loading };
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      <TriangleAlert size={18} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={18} className="spin" />
      Loading your campus…
    </div>
  );
}
export function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <GraduationCap size={22} />
      </span>
      <span>CampusOS</span>
      <small>AI</small>
    </div>
  );
}
const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least eight characters."),
});

function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  async function submit(values: z.infer<typeof loginSchema>) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword(values);
    setError(error?.message || "");
    setBusy(false);
  }
  async function reset() {
    const email = getValues("email");
    if (!z.email().safeParse(email).success) {
      setError("Enter your email address first.");
      return;
    }
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setError(error?.message || "");
    setSent(!error);
    setBusy(false);
  }
  return (
    <main className="login-shell">
      <section className="login-story">
        <Logo />
        <div>
          <div className="eyebrow" style={{ color: "#a5b4fc" }}>
            ONE CAMPUS. ONE CONNECTED EXPERIENCE.
          </div>
          <h1>
            Your campus,
            <br />
            <span>at your fingertips.</span>
          </h1>
          <p>
            A clearer day starts here. Classes, answers and opportunities,
            together in one place.
          </p>
          <div className="login-features">
            <span>
              <CalendarDays size={15} />
              Stay on schedule
            </span>
            <span>
              <Sparkles size={15} />
              Find reliable answers
            </span>
            <span>
              <ShieldCheck size={15} />
              Your data, protected
            </span>
          </div>
        </div>
        <div className="login-bottom">
          CampusOS AI · Institutional intelligence, thoughtfully connected.
        </div>
      </section>
      <section className="login-form-wrap">
        <div className="login-form">
          <div className="eyebrow">YOUR CAMPUS WORKSPACE</div>
          <h2>Welcome to CampusOS</h2>
          <p>Sign in with your institution account to continue.</p>
          {!supabase ? (
            <div className="setup-note">
              <strong>Connect your institution to get started</strong>
              <p>
                This local installation needs Supabase Auth configuration. Add
                your project URL and publishable key to{" "}
                <code>frontend/.env.local</code>, configure the backend, and
                restart.
              </p>
              <p>
                Follow <code>docs/deployment.md</code> to create your first
                institution and membership. CampusOS never grants access based
                on an email address alone.
              </p>
              <a
                className="text-link"
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Supabase dashboard <ArrowUpRight size={14} />
              </a>
            </div>
          ) : (
            <>
              <ErrorBox message={error} />
              {sent && (
                <div className="success" role="status">
                  Check your inbox for the password reset link.
                </div>
              )}
              <form onSubmit={handleSubmit(submit)} noValidate>
                <div>
                  <label htmlFor="email">Institution email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@institution.edu"
                    {...register("email")}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="status-warn">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    {...register("password")}
                    aria-invalid={!!errors.password}
                  />
                  {errors.password && (
                    <p className="status-warn">{errors.password.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : null}
                  Sign in <ArrowRight size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={reset}
                  disabled={busy}
                >
                  Forgot your password?
                </Button>
              </form>
              <p className="subtle" style={{ marginTop: 24 }}>
                New here? Your institution administrator can invite you and
                assign your campus access.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export function CampusApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [members, setMembers] = useState<Membership[]>([]);
  const [tenant, setTenant] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("Home");
  const [more, setMore] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [revision, setRevision] = useState(0);
  const [queued, setQueued] = useState("");
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setMembers([]);
      setTenant("");
      return;
    }
    let live = true;
    setError("");
    api<Membership[]>("/v1/memberships", session, "")
      .then((rows) => {
        if (!live) return;
        setMembers(rows);
        const saved = window.localStorage.getItem("campusos-tenant");
        setTenant((current) =>
          rows.some((m) => m.tenant_id === current)
            ? current
            : rows.some((m) => m.tenant_id === saved)
              ? saved!
              : rows[0]?.tenant_id || "",
        );
        if (!rows.length)
          setError(
            "Your account has no active institution membership. Ask your administrator to grant access.",
          );
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [session]);
  useEffect(() => {
    if (!session || !tenant) return;
    let live = true;
    setError("");
    api<Profile>("/v1/me", session, tenant)
      .then((p) => {
        if (live) setProfile(p);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [session, tenant, revision]);
  useEffect(() => {
    if (mobile)
      document.querySelector<HTMLButtonElement>(".sidebar nav button")?.focus();
  }, [mobile]);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  const download = useCallback(
    async (id: string) => {
      if (!session || !tenant) return;
      try {
        const response = await fetch(`${API}/v1/sources/${id}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "X-Tenant-ID": tenant,
          },
        });
        if (!response.ok)
          throw new Error("This source is unavailable to your account.");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const match = response.headers
          .get("Content-Disposition")
          ?.match(/filename\*=UTF-8''(.+)/);
        link.download = match ? decodeURIComponent(match[1]) : "campus-source";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open source.");
      }
    },
    [session, tenant],
  );
  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setProfile(null);
    setPage("Home");
  }
  function navigate(next: Page) {
    setPage(next);
    setMobile(false);
    setError("");
  }
  function ask(question: string) {
    setQueued(question);
    navigate("Ask CampusOS");
  }
  if (authLoading) return <Loading />;
  if (!session) return <Login />;
  if (
    !profile ||
    profile.tenant_id !== tenant ||
    profile.user_id !== session.user.id
  )
    return (
      <main className="content">
        <Logo />
        {error ? (
          <>
            <ErrorBox message={error} />
            <Button variant="outline" onClick={refresh}>
              Retry connection
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </>
        ) : (
          <Loading />
        )}
      </main>
    );
  const w: Workspace = {
    session,
    tenant,
    profile,
    download,
    refresh,
    revision,
  };
  const admin = [
    "department_admin",
    "institution_admin",
    "platform_admin",
  ].includes(profile.role);
  const primary: [Page, typeof Home][] = [
    ["Home", Home],
    ["Ask CampusOS", MessagesSquare],
    ["Timetable", CalendarDays],
    ["Canteen", Utensils],
    ["Notices", FileText],
  ];
  const secondary: [Page, typeof Home][] = [
    ["Events", Compass],
    ["Faculty", Users],
    ["Calendar", CalendarDays],
    ["Settings", Settings],
  ];
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div
        className={`overlay ${mobile ? "visible" : ""}`}
        onClick={() => setMobile(false)}
        aria-hidden="true"
      />
      <aside
        className={`sidebar ${mobile ? "open" : ""}`}
        aria-label="Campus navigation"
        onKeyDown={(e) => {
          if (!mobile) return;
          if (e.key === "Escape") {
            setMobile(false);
            document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
          }
          if (e.key === "Tab") {
            const nodes = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button,select,a[href]",
              ),
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <Logo />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {primary.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => navigate(label)}
              className={`nav-item ${page === label ? "active" : ""}`}
              aria-current={page === label ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <button
            className="nav-item"
            onClick={() => setMore(!more)}
            aria-expanded={more}
          >
            <MoreHorizontal size={18} />
            More
            <ChevronDown size={14} style={{ marginLeft: "auto" }} />
          </button>
          {more &&
            secondary.map(([label, Icon]) => (
              <button
                key={label}
                onClick={() => navigate(label)}
                className={`nav-item nav-more ${page === label ? "active" : ""}`}
                aria-current={page === label ? "page" : undefined}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          {admin && (
            <>
              <div className="workspace-label" style={{ marginTop: 25 }}>
                MANAGE CAMPUS
              </div>
              <button
                className={`nav-item ${page === "Admin Console" ? "active" : ""}`}
                onClick={() => navigate("Admin Console")}
              >
                <ShieldCheck size={17} />
                Admin Console
              </button>
              <button
                className={`nav-item ${page === "System Intelligence" ? "active" : ""}`}
                onClick={() => navigate("System Intelligence")}
              >
                <Code2 size={17} />
                System Intelligence
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <strong>
              <span className="status-dot" />
              Your campus, connected
            </strong>
            <p>Answers grounded in your sources.</p>
          </div>
          <div className="sidebar-person">
            <div className="avatar">{profile.name[0]}</div>
            <div>
              <strong>{profile.name}</strong>
              <p>
                {profile.department} · Sem {profile.semester} ·{" "}
                {profile.section}
              </p>
            </div>
            <button
              aria-label="Sign out"
              onClick={signOut}
              style={{
                marginLeft: "auto",
                background: "none",
                border: 0,
                color: "#64748b",
                minWidth: 36,
                minHeight: 44,
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="breadcrumb">
            <GraduationCap size={15} />
            Workspace
            <ChevronRight size={12} />
            <strong style={{ color: "#334155" }}>{page}</strong>
          </div>
          <div className="top-right">
            <label className="sr-only" htmlFor="institution">
              Institution
            </label>
            <select
              id="institution"
              className="institution-select"
              value={tenant}
              onChange={(e) => {
                setTenant(e.target.value);
                localStorage.setItem("campusos-tenant", e.target.value);
                setPage("Home");
              }}
            >
              {members.map((m) => (
                <option key={m.tenant_id} value={m.tenant_id}>
                  {m.institution}
                  {m.demo ? " · Demo Data" : ""}
                </option>
              ))}
            </select>
            <div className="avatar" aria-hidden="true">
              {profile.name[0]}
            </div>
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          <ErrorBox message={error} />
          {page === "Home" ? (
            <HomeView w={w} ask={ask} navigate={navigate} />
          ) : page === "Ask CampusOS" ? (
            <ChatView
              key={tenant}
              w={w}
              queued={queued}
              consumed={() => setQueued("")}
            />
          ) : page === "Admin Console" || page === "System Intelligence" ? (
            <AdminView w={w} developer={page === "System Intelligence"} />
          ) : page === "Settings" ? (
            <SettingsView w={w} />
          ) : (
            <BrowseView key={`${tenant}:${page}`} w={w} page={page} />
          )}
          <footer className="page-footer">
            <span>CampusOS AI · Your campus, thoughtfully connected.</span>
            <span>
              {profile.demo
                ? "Synthetic institution · Demo Data"
                : "Institution workspace"}{" "}
              · {profile.timezone}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

const quick = [
  { label: "My next class", icon: CalendarDays },
  { label: "Food under ₹100", icon: Utensils },
  { label: "Latest notices", icon: FileText },
  { label: "Events this week", icon: Compass },
];
export function QuickActions({ ask }: { ask: (q: string) => void }) {
  return (
    <div className="quick-actions">
      {quick.map(({ label, icon: Icon }) => (
        <button className="quick-action" onClick={() => ask(label)} key={label}>
          <Icon size={13} />
          {label}
          <ArrowUpRight size={11} />
        </button>
      ))}
    </div>
  );
}

function HomeView({
  w,
  ask,
  navigate,
}: {
  w: Workspace;
  ask: (q: string) => void;
  navigate: (p: Page) => void;
}) {
  const { data, error, loading } = useRemote<Overview>("/v1/overview", w);
  const [question, setQuestion] = useState("");
  const today = campusDate(w.profile.timezone);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE CLARITY FOR YOUR EVERYDAY</div>
          <h1>
            Good to see you, {w.profile.name.split(" ")[0]}{" "}
            <span aria-hidden="true">☀</span>
          </h1>
          <p>Let’s make the most of your campus day.</p>
        </div>
        <div className="date-label">{prettyDate(today)}</div>
      </div>
      {w.profile.demo && (
        <div className="demo-banner">
          <ShieldCheck size={15} />
          <span>
            You’re exploring a synthetic campus. All sample records are clearly
            marked <strong>Demo Data</strong>.
          </span>
        </div>
      )}
      <section className="hero" aria-label="Ask CampusOS">
        <div className="hero-heading">
          <span className="spark-icon">
            <Sparkles size={22} />
          </span>
          <div>
            <h2>A question away from a clearer day.</h2>
            <p>Your classes, campus updates, and everything in between.</p>
          </div>
        </div>
        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) ask(question.trim());
          }}
        >
          <label className="sr-only" htmlFor="home-question">
            Ask anything about your campus
          </label>
          <input
            id="home-question"
            placeholder="Ask anything about your campus..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={2000}
          />
          <Button type="submit" aria-label="Ask CampusOS">
            <span className="ask-label">Ask CampusOS</span>
            <ArrowUpRight size={18} />
          </Button>
        </form>
        <QuickActions ask={ask} />
        <div className="hero-footnote">
          <ShieldCheck size={12} />
          Grounded in your institution’s data. Every answer comes with a source.
        </div>
      </section>
      <div className="section-header">
        <div>
          <h2>Your day, at a glance</h2>
          <p style={{ marginTop: 5 }}>
            {w.profile.department} · Semester {w.profile.semester} · Section{" "}
            {w.profile.section}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("Calendar")}>
          View calendar <ArrowRight size={14} />
        </Button>
      </div>
      <ErrorBox message={error} />
      {loading ? (
        <div className="dashboard-grid">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : (
        data && (
          <div className="dashboard-grid">
            <div>
              <section className="panel next-panel">
                <div className="next-label">
                  <Clock3 size={14} />
                  UP NEXT
                </div>
                {data.next_class ? (
                  <>
                    <h3>{text(data.next_class.subject)}</h3>
                    <div className="next-info">
                      <span>
                        <Clock3 size={14} />
                        {text(data.next_class.start_time).slice(0, 5)} –{" "}
                        {text(data.next_class.end_time).slice(0, 5)}
                      </span>
                      <span>
                        <MapPin size={14} />
                        {text(data.next_class.room)}
                      </span>
                      <span>{prettyDate(data.next_class.date)}</span>
                    </div>
                    <div className="next-professor">
                      With{" "}
                      {text(
                        data.next_class.faculty || data.next_class.faculty_code,
                      )}
                    </div>
                    <div className="next-bottom">
                      {data.next_class.demo ? <DemoBadge /> : <span />}
                      <button onClick={() => navigate("Timetable")}>
                        View timetable{" "}
                        <ArrowUpRight size={12} style={{ display: "inline" }} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>You’re all caught up.</h3>
                    <p>
                      No upcoming class is listed. Check your timetable for
                      another date.
                    </p>
                    <Button
                      variant="ghost"
                      onClick={() => navigate("Timetable")}
                    >
                      Open timetable
                    </Button>
                  </>
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    <CalendarDays size={16} color="#6366f1" />
                    Today’s schedule
                  </h2>
                  <span className="subtle">{data.classes.length} classes</span>
                </div>
                {data.classes.length ? (
                  data.classes.map((r, i) => (
                    <div className="timeline" key={text(r.id) || i}>
                      <div className="timeline-time">
                        {text(r.start_time).slice(0, 5)}
                      </div>
                      <div className="timeline-marker" />
                      <div>
                        <h3>{text(r.subject)}</h3>
                        <p>
                          {text(r.room)} · {text(r.faculty)}
                        </p>
                        {r.demo && <DemoBadge />}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    message="No classes today"
                    hint="Enjoy the breathing room, or explore upcoming campus events."
                  />
                )}
              </section>
            </div>
            <div>
              <section className="panel" style={{ marginBottom: 20 }}>
                <div className="panel-heading">
                  <h2>
                    <FileText size={16} color="#6366f1" />
                    On your radar
                  </h2>
                  <button
                    className="text-link"
                    onClick={() => navigate("Notices")}
                  >
                    All notices <ArrowRight size={12} />
                  </button>
                </div>
                {data.notices.length ? (
                  data.notices.map((r, i) => (
                    <div className="compact-notice" key={text(r.id) || i}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <span className="subtle">{text(r.category)}</span>
                        {r.demo && <DemoBadge />}
                      </div>
                      <button
                        onClick={() => r.source_id && w.download(r.source_id)}
                      >
                        {text(r.title)}
                      </button>
                      <div className="notice-meta">
                        {prettyDate(r.published)} · View original source
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty message="No current notices" />
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    <Compass size={16} color="#06b6d4" />
                    Something to look forward to
                  </h2>
                  <button
                    className="text-link"
                    onClick={() => navigate("Events")}
                  >
                    Explore <ArrowRight size={12} />
                  </button>
                </div>
                {data.events.length ? (
                  data.events.map((r, i) => (
                    <div className="compact-event" key={text(r.id) || i}>
                      <div className="event-date">
                        {new Date(text(r.start)).toLocaleDateString("en-IN", {
                          month: "short",
                        })}
                        <strong>{new Date(text(r.start)).getDate()}</strong>
                      </div>
                      <div>
                        <h3>{text(r.title)}</h3>
                        <p>
                          {text(r.location)} ·{" "}
                          {text(r.start).split("T")[1]?.slice(0, 5)}
                        </p>
                        {r.demo && <DemoBadge />}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    message="No upcoming events"
                    hint="Check back after the next campus update."
                  />
                )}
                <button
                  className="text-link"
                  onClick={() => ask("Upcoming exams")}
                >
                  <BookOpen size={13} />
                  Check upcoming examinations
                </button>
              </section>
            </div>
          </div>
        )
      )}
    </>
  );
}
