"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GraduationCap,
  CalendarDays,
  Utensils,
  FileText,
  ArrowUpRight,
  Clock3,
  MapPin,
  ArrowRight,
  BookOpen,
  LoaderCircle,
  TriangleAlert,
  ShieldCheck,
  Compass,
  Mic,
  MicOff,
} from "lucide-react";
import { useVoiceInput } from "@/lib/use-voice-input";
import {
  supabase,
  api,
  API,
  campusDate,
  prettyDate,
  text,
  type Profile,
  type DataRecord,
  type Membership,
  type Overview,
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
  | "System Intelligence"
  | "Menu Manager"
  | "More";

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
    <div className="error" role="alert" style={{ marginBottom: 14 }}>
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
    <div className="brand" style={{ padding: 0 }}>
      <div className="logo">C</div>
      <span>
        CampusOS <span style={{ color: "var(--ind6)" }}>AI</span>
      </span>
    </div>
  );
}

function SvgSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4338ca" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
        <symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />
        </symbol>
        <symbol id="i-food" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 3v7a3 3 0 003 3v8M7 3v7M10 3v7a3 3 0 01-3 3M17 3c-2 2-3 5-3 8h3v10" />
        </symbol>
        <symbol id="i-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </symbol>
        <symbol id="i-ai" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 17l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </symbol>
        <symbol id="i-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
        </symbol>
        <symbol id="i-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />
        </symbol>
        <symbol id="i-evt" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5L13.5 13.5 8.5 15.5 10.5 10.5z" />
        </symbol>
        <symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14c2 .7 3.5 2.6 3.5 5" />
        </symbol>
        <symbol id="i-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
        </symbol>
        <symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
        </symbol>
        <symbol id="i-code" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />
        </symbol>
        <symbol id="i-dots" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="19" cy="12" r="1.4" />
        </symbol>
        <symbol id="i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </symbol>
      </defs>
    </svg>
  );
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Use at least six characters."),
});

function Login({
  onSession,
  initialPortal = "student",
}: {
  onSession?: (s: Session) => void;
  initialPortal?: "student" | "admin";
}) {
  const [portal, setPortal] = useState<"student" | "admin">(initialPortal);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: initialPortal === "admin" ? "admin@campus.edu.in" : "student@campus.edu.in",
      password: "123456",
    },
  });

  function fillDemo(email: string, pass: string) {
    setValue("email", email, { shouldValidate: true });
    setValue("password", pass, { shouldValidate: true });
    setError("");
  }

  function handlePortalSwitch(target: "student" | "admin") {
    setPortal(target);
    setError("");
    if (target === "admin") {
      fillDemo("admin@campus.edu.in", "123456");
    } else {
      fillDemo("student@campus.edu.in", "123456");
    }
  }

  async function submit(values: z.infer<typeof loginSchema>) {
    setBusy(true);
    setError("");

    // 1. Try institutional API login with portal partition validation
    try {
      const res = await fetch(`${API}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, portal }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.session) {
          localStorage.setItem("campusos_session", JSON.stringify(data.session));
          if (onSession) onSession(data.session as unknown as Session);
          setBusy(false);
          return;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Invalid institutional credentials.");
        setBusy(false);
        return;
      }
    } catch {
      // Backend may be warming up or offline, fallback to Supabase
    }

    // 2. Fallback to Supabase Auth
    if (supabase) {
      const { data, error: sbError } = await supabase.auth.signInWithPassword(values);
      if (sbError) {
        setError(sbError.message || "Invalid credentials.");
      } else if (data?.session) {
        localStorage.setItem("campusos_session", JSON.stringify(data.session));
        if (onSession) onSession(data.session);
      }
    } else {
      setError("Unable to authenticate. Please verify your credentials.");
    }
    setBusy(false);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handlePortalSwitch("student");
      } else if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handlePortalSwitch("admin");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function reset() {
    const email = getValues("email");
    if (!z.string().email().safeParse(email).success) {
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
    <div className="login">
      <div className={`lp ${portal === "admin" ? "admin-lp" : "student-lp"}`}>
        <div
          className="brand"
          style={{
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 800,
            fontSize: 17,
          }}
        >
          <div className={`logo ${portal === "admin" ? "admin-logo" : ""}`}>C</div>
          <span>
            CampusOS{" "}
            <span style={{ color: portal === "admin" ? "#34d399" : "#818cf8" }}>
              {portal === "admin" ? "Admin" : "AI"}
            </span>
          </span>
        </div>
        <div>
          <div
            className="eyebrow"
            style={{ color: portal === "admin" ? "#6ee7b7" : "#a5b4fc" }}
          >
            {portal === "admin" ? "CAMPUS ADMINISTRATION CONSOLE" : "STUDENT ACCESS WORKSPACE"}
          </div>
          <h2>
            {portal === "admin" ? (
              <>
                Campus Operations,
                <br />
                <span style={{ color: "#34d399" }}>governance & control.</span>
              </>
            ) : (
              <>
                Your campus,
                <br />
                <span style={{ color: "#818cf8" }}>at your fingertips.</span>
              </>
            )}
          </h2>
          <p style={{ color: portal === "admin" ? "#cbd5e1" : "#c7d2fe", maxWidth: 360, lineHeight: 1.6 }}>
            {portal === "admin"
              ? "Restricted institutional console for document OCR ingestion, timetable scheduling, real-time canteen menu management, and governance."
              : "Classes, attendance safe margins, budget canteen meals, and notices — together in your personal student hub."}
          </p>
        </div>
        <div
          style={{
            fontSize: 12,
            color: portal === "admin" ? "#6ee7b7" : "#a5b4fc",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {portal === "admin" ? <ShieldCheck size={14} /> : <GraduationCap size={14} />}
          {portal === "admin"
            ? "Campus Administration · Authorized personnel access only"
            : "CampusOS Student Portal · Grounded in verified institutional data"}
        </div>
      </div>
      <div className="lf">
        <form onSubmit={handleSubmit(submit)} noValidate>
          {/* Portal Selector Tabs */}
          <div className="portal-selector-bar" role="tablist" aria-label="Select Portal">
            <button
              type="button"
              role="tab"
              aria-selected={portal === "student"}
              className={`portal-tab ${portal === "student" ? "active student" : ""}`}
              onClick={() => handlePortalSwitch("student")}
            >
              <GraduationCap size={16} />
              <span>Student Portal</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={portal === "admin"}
              className={`portal-tab ${portal === "admin" ? "active admin" : ""}`}
              onClick={() => handlePortalSwitch("admin")}
            >
              <ShieldCheck size={16} />
              <span>Administrative Portal</span>
            </button>
          </div>

          <div className="eyebrow">
            {portal === "admin" ? "CAMPUS ADMINISTRATION ACCESS" : "STUDENT INSTITUTIONAL ACCESS"}
          </div>
          <h2 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "6px 0" }}>
            {portal === "admin" ? "Administrator Sign In" : "Student Sign In"}
          </h2>
          <p className="mute">
            {portal === "admin"
              ? "Sign in with your administrative credentials to manage campus operations."
              : "Sign in with your student institution account to view classes and campus updates."}
          </p>

          {/* Quick 1-click Demo Fill Pill */}
          <button
            type="button"
            className={`demo-account-pill ${portal === "admin" ? "demo-admin" : "demo-student"}`}
            onClick={() =>
              fillDemo(
                portal === "admin" ? "admin@campus.edu.in" : "student@campus.edu.in",
                "123456",
              )
            }
          >
            {portal === "admin" ? <ShieldCheck size={14} /> : <GraduationCap size={14} />}
            <span>
              Fill Demo {portal === "admin" ? "Admin" : "Student"}:{" "}
              <b>{portal === "admin" ? "admin@campus.edu.in" : "student@campus.edu.in"}</b> · 123456
            </span>
          </button>

          {sent && (
            <div className="success" role="status" style={{ marginTop: 12 }}>
              Check your inbox for the password reset link.
            </div>
          )}

          <label className="lbl" htmlFor="email">
            {portal === "admin" ? "Administrator email" : "Student institution email"}
          </label>
          <input
            className="field"
            id="email"
            type="email"
            autoComplete="username"
            placeholder={portal === "admin" ? "admin@campus.edu.in" : "student@campus.edu.in"}
            style={{ width: "100%" }}
            {...register("email")}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="status-warn" style={{ fontSize: 12, marginTop: 4 }}>
              {errors.email.message}
            </p>
          )}

          <label className="lbl" htmlFor="password">
            Password
          </label>
          <input
            className="field"
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter password"
            style={{ width: "100%" }}
            {...register("password")}
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="status-warn" style={{ fontSize: 12, marginTop: 4 }}>
              {errors.password.message}
            </p>
          )}

          {error && (
            <div
              role="alert"
              style={{
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#e11d48",
                fontSize: 13,
                margin: "12px 0",
                lineHeight: 1.5,
              }}
            >
              <div style={{ marginBottom: error.includes("Switch") || error.includes("Portal") ? 8 : 0 }}>
                {error}
              </div>
              {(error.includes("Administrative Account") || error.includes("Student Portal") || error.includes("privileges")) && (
                <button
                  type="button"
                  className="btn sm"
                  style={{
                    background: portal === "student" ? "#0f172a" : "#4338ca",
                    color: "#fff",
                    fontSize: 12,
                    padding: "4px 10px",
                  }}
                  onClick={() => handlePortalSwitch(portal === "student" ? "admin" : "student")}
                >
                  Switch to {portal === "student" ? "Administrative Portal" : "Student Portal"} →
                </button>
              )}
            </div>
          )}

          <button
            className="btn"
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: 13,
              marginTop: 10,
              background: portal === "admin" ? "linear-gradient(135deg, #059669, #10b981)" : undefined,
            }}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : null}
            Sign in to {portal === "admin" ? "Admin Console" : "Student Workspace"} →
          </button>

          {supabase && (
            <p className="mute" style={{ textAlign: "center", margin: "14px 0" }}>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline" }}
              >
                Forgot your password?
              </button>
            </p>
          )}

          <p className="mute" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 16, textAlign: "center" }}>
            CampusOS Institutional Access · Secure login for students, faculty & administration
          </p>
        </form>
      </div>
    </div>
  );
}

const CMDS: [string, Page | "@switch_admin" | "@switch_student" | `ask:${string}`, string, "*" | "student" | "admin"][] = [
  ["Go to Home", "Home", "i-home", "*"],
  ["Ask CampusOS", "Ask CampusOS", "i-ai", "*"],
  ["Go to Timetable", "Timetable", "i-cal", "*"],
  ["Go to Canteen", "Canteen", "i-food", "*"],
  ["Notices", "Notices", "i-bell", "*"],
  ["Events", "Events", "i-evt", "*"],
  ["Faculty", "Faculty", "i-user", "*"],
  ["Calendar", "Calendar", "i-cal", "*"],
  ["Settings", "Settings", "i-gear", "*"],
  ["Operating Systems · LH-204 · 11:30", "Timetable", "i-cal", "student"],
  ["Paneer Rice Bowl · ₹90", "Canteen", "i-food", "student"],
  ["Switch to Admin Portal (Requires Login)", "@switch_admin", "i-shield", "student"],
  ["Admin Console", "Admin Console", "i-shield", "admin"],
  ["System Intelligence", "System Intelligence", "i-code", "admin"],
  ["Menu Manager", "Menu Manager", "i-food", "admin"],
  ["Switch to Student Portal (Requires Login)", "@switch_student", "i-home", "admin"],
];

export function CampusApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [portalTarget, setPortalTarget] = useState<"student" | "admin">("student");
  const [members, setMembers] = useState<Membership[]>([]);
  const [tenant, setTenant] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("Home");
  const [more, setMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [queued, setQueued] = useState("");
  const [palOpen, setPalOpen] = useState(false);
  const [palQuery, setPalQuery] = useState("");
  const [palSel, setPalSel] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [isMac, setIsMac] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const palInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)) {
      setIsMac(true);
    }
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("campusos_session");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?.access_token && parsed?.user) {
            setSession(parsed as Session);
            setAuthLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem("campusos_session");
        }
      }
    }
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) setSession(next);
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

  const admin = Boolean(
    profile &&
      ["department_admin", "institution_admin", "platform_admin"].includes(
        profile.role,
      ),
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.toggle("admin", admin);
    }
  }, [admin]);

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

  const signOut = useCallback(
    async (targetPortal?: "student" | "admin") => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("campusos_session");
      }
      if (typeof document !== "undefined") {
        document.body.classList.remove("admin");
      }
      await supabase?.auth.signOut();
      setSession(null);
      setProfile(null);
      setPage("Home");
      if (targetPortal) {
        setPortalTarget(targetPortal);
      }
    },
    [],
  );

  const switchPortalWithAuth = useCallback(
    async (target: "student" | "admin") => {
      await signOut(target);
      showToast(
        `Please log in with your ${target === "admin" ? "administrative" : "student"} credentials.`,
      );
    },
    [signOut, showToast],
  );

  const navigate = useCallback(
    (next: Page) => {
      if (admin && next === "Settings") {
        setPage("Home");
        return;
      }
      if (admin && next === "Canteen") {
        setPage("Menu Manager");
        return;
      }
      if (
        !admin &&
        (next === "Admin Console" ||
          next === "System Intelligence" ||
          next === "Menu Manager")
      ) {
        showToast("That page is only available to the admin role");
        return;
      }
      if (["Events", "Faculty", "Calendar", "Settings"].includes(next)) {
        setMore(true);
      }
      setPage(next);
      setError("");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0 });
      }
    },
    [admin, showToast],
  );

  function ask(question: string) {
    setQueued(question);
    navigate("Ask CampusOS");
  }

  const filteredCmds = CMDS.filter(
    (c) =>
      (c[3] === "*" || c[3] === (admin ? "admin" : "student")) &&
      c[0].toLowerCase().includes(palQuery.toLowerCase()),
  );

  const runCmd = useCallback(
    (cmd?: (typeof CMDS)[number]) => {
      setPalOpen(false);
      if (!cmd) return;
      const target = cmd[1];
      if (target === "@switch_admin") {
        void switchPortalWithAuth("admin");
      } else if (target === "@switch_student") {
        void switchPortalWithAuth("student");
      } else if (target.startsWith("ask:")) {
        ask(target.slice(4));
      } else {
        navigate(target as Page);
      }
    },
    [navigate, switchPortalWithAuth],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalOpen((prev) => {
          const next = !prev;
          if (next) {
            setPalQuery("");
            setPalSel(0);
            setTimeout(() => palInputRef.current?.focus(), 20);
          }
          return next;
        });
        return;
      }
      if (!palOpen) return;
      if (e.key === "Escape") {
        setPalOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setPalSel((s) => (s + 1) % Math.max(filteredCmds.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPalSel(
          (s) =>
            (s - 1 + Math.max(filteredCmds.length, 1)) %
            Math.max(filteredCmds.length, 1),
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        runCmd(filteredCmds[palSel]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [palOpen, filteredCmds, palSel, runCmd]);

  if (authLoading) return <Loading />;
  if (!session)
    return (
      <>
        <SvgSprite />
        <Login
          initialPortal={portalTarget}
          onSession={(s) => setSession(s)}
        />
      </>
    );
  if (
    !profile ||
    profile.tenant_id !== tenant ||
    profile.user_id !== session.user.id
  )
    return (
      <main className="content">
        <SvgSprite />
        <Logo />
        {error ? (
          <>
            <ErrorBox message={error} />
            <Button variant="outline" onClick={refresh}>
              Retry connection
            </Button>
            <Button variant="ghost" onClick={() => signOut()}>
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

  const navPrimary: [Page, string, string][] = [
    ["Home", "Home", "i-home"],
    ["Ask CampusOS", "Ask CampusOS", "i-ai"],
    ["Timetable", "Timetable", "i-cal"],
    ...(!admin ? [["Canteen", "Canteen", "i-food"] as [Page, string, string]] : []),
    ["Notices", "Notices", "i-bell"],
  ];

  const navSecondary: [Page, string, string][] = [
    ["Events", "Events", "i-evt"],
    ["Faculty", "Faculty", "i-user"],
    ["Calendar", "Calendar", "i-cal"],
    ...(!admin ? [["Settings", "Settings", "i-gear"] as [Page, string, string]] : []),
  ];

  const bottomItems: [Page, string, string][] = [
    ["Home", "Home", "i-home"],
    ["Ask CampusOS", "Ask", "i-ai"],
    ["Timetable", "Classes", "i-cal"],
    ["Canteen", "Food", "i-food"],
    ["More", "More", "i-dots"],
  ];

  return (
    <>
      <SvgSprite />
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div className="app">
        <aside className="side" aria-label="Campus navigation">
          <div className="brand">
            <div className="logo">C</div>
            <span className="t">
              CampusOS <span style={{ color: "var(--ind6)" }}>AI</span>
            </span>
          </div>
          <div className="sec-label">
            {admin ? "CAMPUS WORKSPACE" : "STUDENT WORKSPACE"}
          </div>
          {navPrimary.map(([target, label, icon]) => (
            <button
              key={target}
              type="button"
              className={`nav ${page === target ? "on" : ""}`}
              onClick={() => navigate(target)}
              aria-current={page === target ? "page" : undefined}
            >
              <svg>
                <use href={`#${icon}`} />
              </svg>
              <span className="t">{label}</span>
            </button>
          ))}
          <button
            type="button"
            className="nav"
            onClick={() => setMore(!more)}
            aria-expanded={more}
          >
            <svg>
              <use href="#i-dots" />
            </svg>
            <span className="t">More</span>
            <span className="t" style={{ marginLeft: "auto" }}>
              ▾
            </span>
          </button>
          <div className={`sub ${more ? "on" : ""}`}>
            {navSecondary.map(([target, label, icon]) => (
              <button
                key={target}
                type="button"
                className={`nav ${page === target ? "on" : ""}`}
                onClick={() => navigate(target)}
                aria-current={page === target ? "page" : undefined}
              >
                <svg>
                  <use href={`#${icon}`} />
                </svg>
                <span className="t">{label}</span>
              </button>
            ))}
          </div>

          {admin && (
            <>
              <div className="sec-label">MANAGE CAMPUS</div>
              <button
                type="button"
                className={`nav ${page === "Admin Console" ? "on" : ""}`}
                onClick={() => navigate("Admin Console")}
              >
                <svg>
                  <use href="#i-shield" />
                </svg>
                <span className="t">Admin Console</span>
              </button>
              <button
                type="button"
                className={`nav ${page === "System Intelligence" ? "on" : ""}`}
                onClick={() => navigate("System Intelligence")}
              >
                <svg>
                  <use href="#i-code" />
                </svg>
                <span className="t">System Intelligence</span>
              </button>
              <button
                type="button"
                className={`nav ${page === "Menu Manager" ? "on" : ""}`}
                onClick={() => navigate("Menu Manager")}
              >
                <svg>
                  <use href="#i-food" />
                </svg>
                <span className="t">Menu Manager</span>
              </button>
            </>
          )}

          <div
            className="card mute t"
            style={{ marginTop: "auto", flex: "none", padding: 12 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="av">{profile.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--ink)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {profile.name}
                </div>
                <span
                  className={`badge ${admin ? "b-adm" : "b-stu"}`}
                  style={{ fontSize: 10, padding: "1px 8px" }}
                >
                  {admin ? "ADMIN" : "STUDENT"}
                </span>
                <div className="mono mute" style={{ fontSize: 10 }}>
                  {admin
                    ? "Administration"
                    : `${profile.department} · Sem ${profile.semester} · ${profile.section}`}
                </div>
              </div>
              <button
                type="button"
                className="so"
                onClick={() => signOut()}
                title="Sign out"
                aria-label="Sign out"
              >
                ⎋
              </button>
            </div>
          </div>
        </aside>

        <main id="main" className="main" tabIndex={-1}>
          <header className="top">
            <div className="crumb">
              <span>Workspace</span>
              <span>›</span>
              <b>{page}</b>
            </div>
            <button
              type="button"
              className="search"
              onClick={() => {
                setPalOpen(true);
                setPalQuery("");
                setPalSel(0);
                setTimeout(() => palInputRef.current?.focus(), 20);
              }}
              aria-label="Open command bar"
            >
              <svg width="16" height="16">
                <use href="#i-s" />
              </svg>
              <span>
                {admin
                  ? "Search documents, menu items, reviews…"
                  : "Search classes, food, documents…"}
              </span>
              <span className="kbd">{isMac ? "⌘ K" : "Ctrl K"}</span>
            </button>
            <div className="portal-header-badge">
              <span
                className={`badge ${admin ? "b-adm" : "b-stu"}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {admin ? <ShieldCheck size={13} /> : <GraduationCap size={13} />}
                {admin ? "ADMIN CONSOLE" : "STUDENT PORTAL"}
              </span>
              <button
                type="button"
                className="switch-portal-nav"
                onClick={() => switchPortalWithAuth(admin ? "student" : "admin")}
                title={`Sign out and log in to ${admin ? "Student Portal" : "Admin Portal"}`}
              >
                {admin ? <GraduationCap size={13} /> : <ShieldCheck size={13} />}
                <span>Switch to {admin ? "Student Portal" : "Admin Portal"} ↗</span>
              </button>
            </div>
            {members.length > 1 ? (
              <select
                aria-label="Institution"
                className="institution-select mute tenant"
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
                  </option>
                ))}
              </select>
            ) : (
              <span className="mute tenant">
                {members[0]?.institution || "RVCE Campus Intelligence"}
              </span>
            )}
            <div className="av" aria-hidden="true">
              {profile.name[0]}
            </div>
          </header>

          <div className="view-anim" key={page}>
            <ErrorBox message={error} />
            {page === "Home" ? (
              <HomeView
                w={w}
                ask={ask}
                navigate={navigate}
                showToast={showToast}
                institution={members[0]?.institution || "RV College of Engineering"}
              />
            ) : page === "Ask CampusOS" ? (
              <ChatView
                key={tenant}
                w={w}
                queued={queued}
                consumed={() => setQueued("")}
              />
            ) : page === "Admin Console" || page === "System Intelligence" ? (
              admin ? (
                <AdminView w={w} developer={page === "System Intelligence"} />
              ) : (
                <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <ShieldCheck size={40} color="#ef4444" style={{ margin: "0 auto 16px" }} />
                  <h2 style={{ fontSize: 20 }}>Administrative Access Restricted</h2>
                  <p className="mute" style={{ maxWidth: 460, margin: "12px auto 24px", lineHeight: 1.6 }}>
                    You are currently logged in as a student (<strong>{profile.name}</strong>).
                    Campus administration, vision data ingestion, and system controls are restricted to authorized administrators.
                  </p>
                  <button className="btn" onClick={() => setPage("Home")}>
                    Return to Student Portal
                  </button>
                </div>
              )
            ) : page === "Menu Manager" ? (
              <MenuManagerView w={w} showToast={showToast} navigate={navigate} />
            ) : page === "Settings" ? (
              admin ? (
                <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <ShieldCheck size={40} color="#047857" style={{ margin: "0 auto 16px" }} />
                  <h2 style={{ fontSize: 20 }}>Student Preferences Only</h2>
                  <p className="mute" style={{ maxWidth: 460, margin: "12px auto 24px", lineHeight: 1.6 }}>
                    Personal student preferences (diet, academic interests, and calendar integrations) are only
                    configured on student accounts. Administrative controls are managed through the Admin Console and Menu Manager.
                  </p>
                  <button className="btn" onClick={() => setPage("Home")}>
                    Return to Home
                  </button>
                </div>
              ) : (
                <SettingsView w={w} />
              )
            ) : page === "More" ? (
              <MoreView admin={admin} navigate={navigate} />
            ) : (
              <BrowseView key={`${tenant}:${page}`} w={w} page={page} />
            )}
          </div>

          <footer className="page-footer">
            <span>CampusOS AI · Your campus, thoughtfully connected.</span>
            <span>
              Institution workspace{" "}
              · {profile.timezone}
            </span>
          </footer>
        </main>
      </div>

      <nav className="bottom" aria-label="Mobile navigation">
        {bottomItems.map(([target, label, icon]) => (
          <button
            key={target}
            type="button"
            className={`nav ${page === target ? "on" : ""}`}
            onClick={() => navigate(target)}
          >
            <svg width="20" height="20">
              <use href={`#${icon}`} />
            </svg>
            {label}
          </button>
        ))}
      </nav>

      <div
        className={`ov ${palOpen ? "on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPalOpen(false);
        }}
      >
        <div className="pal" role="dialog" aria-label="Command bar">
          <input
            ref={palInputRef}
            value={palQuery}
            onChange={(e) => {
              setPalQuery(e.target.value);
              setPalSel(0);
            }}
            placeholder="Type a command or search…"
            autoComplete="off"
          />
          <ul>
            {filteredCmds.length ? (
              filteredCmds.map((c, i) => (
                <li
                  key={c[0]}
                  className={i === palSel ? "on" : ""}
                  onClick={() => runCmd(c)}
                >
                  <svg width="18" height="18">
                    <use href={`#${c[2]}`} />
                  </svg>
                  {c[0]}
                </li>
              ))
            ) : (
              <li className="mute">No matches. Try “canteen” or “timetable”.</li>
            )}
          </ul>
        </div>
      </div>

      <div className={`toast ${toastMsg ? "on" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
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
    <div className="chips" style={{ padding: "12px 0 6px" }}>
      {quick.map(({ label }) => (
        <button
          type="button"
          className="chip"
          onClick={() => ask(label)}
          key={label}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function HomeSearchBox({
  question,
  setQuestion,
  ask,
}: {
  question: string;
  setQuestion: (q: string) => void;
  ask: (q: string) => void;
}) {
  const { isListening, isTranscribing, toggleListening, error } = useVoiceInput({
    onTranscript: (spoken) => setQuestion(spoken),
  });

  return (
    <>
      <form
        className="inp"
        style={{ padding: 0, border: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask(question.trim());
        }}
      >
        <div className="home-search-wrapper">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              isTranscribing
                ? "Transcribing voice with Whisper STT model..."
                : isListening
                ? "Listening... speak your question now"
                : "Ask anything about your campus…"
            }
            autoComplete="off"
            disabled={isTranscribing}
            style={
              isListening
                ? {
                    borderColor: "#ef4444",
                    boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.25)",
                  }
                : undefined
            }
          />
          <button
            type="button"
            className={`home-voice-btn ${isListening ? "listening" : ""} ${isTranscribing ? "transcribing" : ""}`}
            onClick={toggleListening}
            disabled={isTranscribing}
            title={
              isTranscribing
                ? "Transcribing with Whisper STT model..."
                : isListening
                ? "Listening... click to stop (Whisper STT Model)"
                : "Ask using voice (Whisper STT Model)"
            }
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isTranscribing ? (
              <LoaderCircle className="spin" size={17} />
            ) : isListening ? (
              <MicOff size={17} />
            ) : (
              <Mic size={17} />
            )}
          </button>
        </div>
        <button
          className="btn"
          type="submit"
          disabled={isTranscribing || (!question.trim() && !isListening)}
        >
          Ask CampusOS ↗
        </button>
      </form>
      {isListening && (
        <div className="voice-active-banner">
          <span className="dot" style={{ background: "#ef4444" }} />
          <span>Listening... Speak your question now (Whisper STT large-v3-turbo active)</span>
        </div>
      )}
      {error && (
        <div className="status-warn" style={{ fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </>
  );
}

function HomeView({
  w,
  ask,
  navigate,
  showToast,
  institution,
}: {
  w: Workspace;
  ask: (q: string) => void;
  navigate: (p: Page) => void;
  showToast: (msg: string) => void;
  institution: string;
}) {
  const { data, error, loading } = useRemote<Overview>("/v1/overview", w);
  const [question, setQuestion] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const [ringOffset, setRingOffset] = useState(389.6);
  const [mins, setMins] = useState(24);
  const [reviews, setReviews] = useState([
    ["menu-nov-w2.jpg", "Canteen menu · Nov week 2", 96],
    ["circular-117.pdf", "Circular · Mid-sem exam schedule", 88],
    ["cse-s3b-timetable.pdf", "Timetable · CSE Sem 3 Sec B", 74],
  ] as [string, string, number][]);

  const isAdmin = [
    "department_admin",
    "institution_admin",
    "platform_admin",
  ].includes(w.profile.role);

  useEffect(() => {
    const att = isAdmin ? 91.2 : 89.4;
    const c = 389.6;
    const timer = setTimeout(() => {
      setRingOffset(c - (c * att) / 100);
    }, 80);
    return () => clearTimeout(timer);
  }, [isAdmin]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMins((m) => (m > 1 ? m - 1 : 1));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const firstName = w.profile.name.split(" ")[0] || "Alex";
  const nextClass = data?.next_class;
  const classCount = data?.classes?.length ?? 4;

  return (
    <>
      {isAdmin ? (
        <div className="bento" style={{ marginBottom: 22 }}>
          <div className="card hero">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span className="dot" />
              <span className="mute mono" style={{ fontSize: 12 }}>
                Admin console · {institution}
              </span>
            </div>
            <h1 className="h1">Welcome back, {w.profile.name}</h1>
            <p className="mute" style={{ margin: "10px 0 18px", fontSize: 15 }}>
              3 documents processed today. <span>{reviews.length}</span> items need your review.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
              <span className="badge b-adm">Admin · {w.session.user.email || "admin@campus.edu.in"}</span>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => navigate("Admin Console")}
              >
                Upload a document
              </button>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 12" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
              <div className="logo" style={{ width: 40, height: 40 }}>
                <svg width="20" height="20">
                  <use href="#i-ai" />
                </svg>
              </div>
              <div>
                <h3 className="h3" style={{ fontSize: 18 }}>
                  A question away from a clearer day.
                </h3>
                <div className="mute">
                  Query campus-wide schedules, circulars, menu items, and ingested records.
                </div>
              </div>
            </div>
            <HomeSearchBox question={question} setQuestion={setQuestion} ask={ask} />
            <QuickActions ask={ask} />
          </div>

          <div className="card k">
            <div className="mute">Documents ingested</div>
            <div className="kv">128</div>
            <span className="badge b-adm">+3 today</span>
          </div>
          <div className="card k">
            <div className="mute">Active students</div>
            <div className="kv">4,310</div>
            <span className="badge b-adm">96% of roll</span>
          </div>

          <div className="card rev">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="h3">Needs review</h3>
              <span className="badge b-adm">{reviews.length} pending</span>
            </div>
            <div>
              {reviews.length ? (
                reviews.map((r, i) => (
                  <div className="rv" key={r[0]}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r[1]}</div>
                      <div className="mono mute" style={{ fontSize: 11 }}>
                        {r[0]} · {r[2]}% confidence
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        showToast(`Published ${r[0]}`);
                        setReviews((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => {
                        showToast(`Dismissed ${r[0]}`);
                        setReviews((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                ))
              ) : (
                <div className="mute" style={{ padding: "16px 0" }}>
                  All caught up. New uploads will appear here.
                </div>
              )}
            </div>
          </div>

          <div className="card hrs">
            <h3 className="h3">Canteen orders by hour</h3>
            <div className="hbars">
              {(
                [
                  ["8", 18],
                  ["9", 34],
                  ["10", 52],
                  ["11", 70],
                  ["12", 92],
                  ["1", 100],
                  ["2", 64],
                  ["3", 30],
                ] as [string, number][]
              ).map(([h, pct]) => (
                <div key={h}>
                  <i style={{ height: `${pct * 0.78}%` }} />
                  <span className="mono mute">{h}</span>
                </div>
              ))}
            </div>
            <div className="mute" style={{ marginTop: 8 }}>
              Peak: 1 PM, about 38% of daily orders.
            </div>
          </div>
        </div>
      ) : (
        <div className="bento" style={{ marginBottom: 22 }}>
          <div className="card hero">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span className="dot" />
              <span className="mute mono" style={{ fontSize: 12 }}>
                Connected · {institution}
              </span>
            </div>
            <h1 className="h1">Welcome back, {firstName}</h1>
            <p className="mute" style={{ margin: "10px 0 18px", fontSize: 15 }}>
              You have {classCount} classes today. Lunch opens at 12:30.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
              <span className="badge b-stu">Student · {w.session.user.email || "student@campus.edu.in"}</span>
              <span
                className="badge"
                style={{
                  background: "rgba(255,255,255,.12)",
                  color: "#fff",
                  borderColor: "rgba(255,255,255,.3)",
                }}
              >
                {w.profile.name} · {w.profile.department} Sem {w.profile.semester} Sec {w.profile.section}
              </span>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 12" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
              <div className="logo" style={{ width: 40, height: 40 }}>
                <svg width="20" height="20">
                  <use href="#i-ai" />
                </svg>
              </div>
              <div>
                <h3 className="h3" style={{ fontSize: 18 }}>
                  A question away from a clearer day.
                </h3>
                <div className="mute">
                  Your classes, campus updates, and everything in between.
                </div>
              </div>
            </div>
            <HomeSearchBox question={question} setQuestion={setQuestion} ask={ask} />
            <QuickActions ask={ask} />
            <div className="mute" style={{ fontSize: 12 }}>
              Grounded in your institution’s data. Every answer comes with a source.
            </div>
          </div>

          <div className="card next">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span className="badge b-adm">
                <span className="dot" />
                UP NEXT
              </span>
              <span className="mono mute">In {mins} Minutes</span>
            </div>
            <h2 className="h1" style={{ fontSize: 26 }}>
              {nextClass ? text(nextClass.subject) : "Operating Systems"}
            </h2>
            <div
              style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "12px 0 18px" }}
              className="mute"
            >
              <span>
                📍{" "}
                <b style={{ color: "var(--ink)" }}>
                  {nextClass ? text(nextClass.room) : "LH-204, Block B"}
                </b>
              </span>
              <span>
                👤 Faculty{" "}
                <b className="mono" style={{ color: "var(--ink)" }}>
                  {nextClass
                    ? text(nextClass.faculty_code || nextClass.faculty)
                    : "SRK"}
                </b>
              </span>
              <span>
                🕐{" "}
                {nextClass
                  ? `${text(nextClass.start_time).slice(0, 5)} – ${text(nextClass.end_time).slice(0, 5)}`
                  : "11:30 – 12:30"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn"
                style={
                  checkedIn
                    ? { background: "linear-gradient(135deg,#047857,#10b981)" }
                    : undefined
                }
                onClick={() => {
                  setCheckedIn(true);
                  showToast(
                    `Attendance marked for ${nextClass ? text(nextClass.subject) : "Operating Systems"}`,
                  );
                }}
              >
                {checkedIn ? "✓ Marked present" : "Mark attendance"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate("Timetable")}
              >
                Full timetable
              </button>
            </div>
          </div>

          <div className="card ring" style={{ textAlign: "center" }}>
            <h3 className="h3" style={{ textAlign: "left" }}>
              Attendance · target 75%
            </h3>
            <div style={{ position: "relative", width: 150, height: 150, margin: "14px auto 8px" }}>
              <svg className="ringsvg" viewBox="0 0 150 150">
                <circle className="bg" cx="75" cy="75" r="62" />
                <circle
                  className="fg"
                  cx="75"
                  cy="75"
                  r="62"
                  strokeDasharray="389.6"
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>
                  89.4%
                </div>
                <div className="mute">safe margin</div>
              </div>
            </div>
            <span className="badge b-adm">Safe · +14.4% above target</span>
          </div>

          <div className="card pick">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="badge b-stu">Lunch pick · under ₹100</span>
              <span className="veg" title="Vegetarian" />
            </div>
            <h2 className="h1" style={{ fontSize: 24, margin: "12px 0 4px" }}>
              Paneer Rice Bowl
            </h2>
            <div className="mute">Open till 3:00 PM at Main Canteen</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "16px 0 8px" }}>
              <span className="price" style={{ fontSize: 28 }}>
                ₹90
              </span>
              <span className="mono mute">24g protein · 540 kcal</span>
            </div>
            <div className="bar">
              <i style={{ width: "30%", background: "#4338ca" }} title="Protein" />
              <i style={{ width: "52%", background: "#818cf8" }} title="Carbs" />
              <i style={{ width: "18%", background: "#c7d2fe" }} title="Fat" />
            </div>
            <div className="mute" style={{ marginTop: 8, display: "flex", gap: 14, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 14 }}>
                <span>● Protein 30%</span>
                <span style={{ color: "#818cf8" }}>● Carbs 52%</span>
                <span style={{ color: "#a5b4fc" }}>● Fat 18%</span>
              </div>
              <button
                type="button"
                className="text-link"
                onClick={() => navigate("Canteen")}
              >
                Canteen <ArrowRight size={12} />
              </button>
            </div>
          </div>

          <div className="card stat">
            <h3 className="h3">This week</h3>
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {(
                [
                  ["Classes attended", "17 / 19", 89],
                  ["Canteen spend", "₹410", 41],
                  ["Assignments due", "2", 20],
                ] as [string, string, number][]
              ).map(([label, val, pct]) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                    <span>{label}</span>
                    <span className="mono">{val}</span>
                  </div>
                  <div className="bar" style={{ marginTop: 6 }}>
                    <i
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg,#4338ca,#4f46e5)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

const INITIAL_FOOD: [string, number, boolean, number, string, boolean][] = [
  ["Masala Dosa", 45, true, 8, "South Indian", true],
  ["Idli Vada (2+1)", 35, true, 9, "South Indian", true],
  ["Veg Fried Rice", 70, true, 11, "Chinese", true],
  ["Paneer Rice Bowl", 90, true, 24, "Bowls", true],
  ["Chole Bhature", 60, true, 16, "North Indian", true],
  ["Egg Roll", 50, false, 14, "Rolls", true],
  ["Chicken Biryani", 120, false, 32, "Biryani", true],
  ["Veg Thali", 85, true, 18, "Meals", true],
  ["Chicken Noodles", 95, false, 22, "Chinese", true],
  ["Sprouts Salad", 30, true, 12, "Healthy", true],
  ["Filter Coffee", 20, true, 3, "Beverages", true],
];

function MenuManagerView({
  w,
  showToast,
  navigate,
}: {
  w: Workspace;
  showToast: (msg: string) => void;
  navigate: (p: Page) => void;
}) {
  const { data, error, loading } = useRemote<DataRecord[]>("/v1/menu?budget=9999", w);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [meal, setMeal] = useState("lunch");
  const [isVeg, setIsVeg] = useState(true);
  const [query, setQuery] = useState("");
  const [filterMeal, setFilterMeal] = useState("all");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const items = Array.isArray(data) ? data : [];
  const filtered = items.filter((it) => {
    if (filterMeal !== "all" && String(it.meal || it.category).toLowerCase() !== filterMeal.toLowerCase()) {
      return false;
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      const n = String(it.name || it.item || "").toLowerCase();
      const m = String(it.meal || it.category || "").toLowerCase();
      if (!n.includes(q) && !m.includes(q)) return false;
    }
    return true;
  });

  async function handleDelete(itemId: string, itemName: string) {
    if (!window.confirm(`Delete "${itemName}" from canteen menu? This will immediately remove it from the student interface.`)) {
      return;
    }
    setActionError("");
    try {
      await api(`/v1/menu/${encodeURIComponent(itemId)}`, w.session, w.tenant, {
        method: "DELETE",
      });
      showToast(`Deleted "${itemName}" from canteen`);
      w.refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setBusy(true);
    setActionError("");
    try {
      await api("/v1/menu", w.session, w.tenant, {
        method: "POST",
        body: JSON.stringify({
          item: name.trim(),
          price: Number(price),
          meal,
          is_veg: isVeg,
          facility: "Main Mess & Canteen",
        }),
      });
      setName("");
      setPrice("");
      showToast(`Added "${name.trim()}" to canteen menu`);
      w.refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 className="h1" style={{ marginBottom: 6 }}>
            Canteen Menu Manager
          </h1>
          <p className="mute" style={{ margin: 0 }}>
            Manage all campus food items. Every addition and deletion is instantly live and synchronized with the student interface.
          </p>
        </div>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => navigate("Admin Console")}
        >
          Import menu PDF/CSV →
        </button>
      </div>

      <ErrorBox message={error || actionError} />

      {/* Add New Food Item Form */}
      <div className="card" style={{ marginBottom: 20, padding: "18px 20px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Add New Dish to Canteen</h3>
        <form
          onSubmit={handleAdd}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
        >
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dish name (e.g. Masala Dosa, Paneer Rice)"
            required
            style={{ flex: "2 1 200px" }}
          />
          <input
            className="field"
            type="number"
            min="5"
            max="1000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (₹)"
            required
            style={{ flex: "1 1 110px", maxWidth: 130 }}
          />
          <select
            className="field"
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            style={{ flex: "1 1 120px", maxWidth: 140 }}
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="snacks">Snacks</option>
            <option value="dinner">Dinner</option>
          </select>
          <div className="switch">
            <button
              type="button"
              className={isVeg ? "on" : ""}
              onClick={() => setIsVeg(true)}
            >
              Veg
            </button>
            <button
              type="button"
              className={!isVeg ? "on" : ""}
              onClick={() => setIsVeg(false)}
            >
              Non-veg
            </button>
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Adding…" : "+ Add Dish"}
          </button>
        </form>
      </div>

      {/* Filter and Item Count Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            Active Canteen Dishes ({filtered.length})
          </span>
          <div className="switch" style={{ marginLeft: 8 }}>
            {(["all", "breakfast", "lunch", "snacks", "dinner"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={filterMeal === m ? "on" : ""}
                onClick={() => setFilterMeal(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <input
          className="field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter dishes…"
          style={{ maxWidth: 220, padding: "7px 12px", fontSize: 13 }}
        />
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((item, idx) => {
            const isItemVeg = item.vegetarian ?? item.is_veg ?? true;
            const itemId = String(item.id || item.item || item.name || idx);
            const itemName = String(item.name || item.item || "Dish");
            const itemPrice = text(item.price);
            const itemMeal = String(item.category || item.meal || "Lunch");

            return (
              <div
                className="mrow"
                key={itemId}
                style={{
                  gridTemplateColumns: "1fr auto auto",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span className={isItemVeg ? "veg-badge" : "nonveg-badge"}>
                    {isItemVeg ? "Veg" : "Non-Veg"}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>
                      {itemName}
                    </div>
                    <div className="mute" style={{ fontSize: 12 }}>
                      {itemMeal} · {item.protein ? `${item.protein}g protein` : "Standard nutrition"}
                    </div>
                  </div>
                </div>

                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--foreground)", padding: "0 14px" }}>
                  ₹{itemPrice}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(itemId, itemName)}
                  style={{ color: "#ef4444", borderColor: "#fecaca" }}
                  title={`Delete ${itemName} from canteen`}
                >
                  Delete
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          message="No matching food items found"
          hint="Try clearing search filters or upload a menu PDF via the Admin Console."
        />
      )}
    </section>
  );
}

function MoreView({
  admin,
  navigate,
}: {
  admin: boolean;
  navigate: (p: Page) => void;
}) {
  const links: [Page, string, string][] = [
    ["Notices", "i-bell", "Notices"],
    ["Events", "i-evt", "Events"],
    ["Faculty", "i-user", "Faculty"],
    ["Calendar", "i-cal", "Calendar"],
    ["Settings", "i-gear", "Settings"],
  ];
  if (admin) {
    links.push(
      ["Admin Console", "i-shield", "Admin Console"],
      ["System Intelligence", "i-code", "System Intelligence"],
      ["Menu Manager", "i-food", "Menu Manager"],
    );
  }
  return (
    <section>
      <div className="eyebrow">Your workspace</div>
      <h1 className="h1" style={{ margin: "4px 0 6px" }}>
        More
      </h1>
      <p className="mute" style={{ margin: "0 0 18px" }}>
        Everything else in CampusOS.
      </p>
      <div className="bento-grid">
        {links.map(([target, icon, label]) => (
          <button
            key={target}
            type="button"
            className="card"
            onClick={() => navigate(target)}
            style={{
              textAlign: "left",
              display: "flex",
              gap: 12,
              alignItems: "center",
              fontWeight: 700,
              color: "inherit",
            }}
          >
            <svg width="20" height="20">
              <use href={`#${icon}`} />
            </svg>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
