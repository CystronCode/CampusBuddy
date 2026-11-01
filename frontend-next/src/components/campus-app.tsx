"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TriangleAlert, LoaderCircle, GraduationCap, ArrowRight } from "lucide-react";
import { supabase, api, API, type Profile, type Membership, type Overview, type DataRecord } from "@/lib/api";

export type Page =
  | "home"
  | "canteen"
  | "timetable"
  | "chat"
  | "ahome"
  | "menu"
  | "manage"
  | "settings"
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
    <div className="badge b-stu" style={{ background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca", padding: "8px 14px", borderRadius: 12, marginBottom: 16 }}>
      <TriangleAlert size={16} style={{ display: "inline", marginRight: 8 }} />
      <span>{message}</span>
    </div>
  ) : null;
}

export function Loading() {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: 20 }}>
      <LoaderCircle size={18} className="spin" style={{ color: "var(--ind6)" }} />
      <span>Loading campus intelligence…</span>
    </div>
  );
}

export function Logo() {
  return (
    <div className="brand">
      <div className="logo">C</div>
      <span className="t">CampusOS <span style={{ color: "var(--ind6)" }}>AI</span></span>
    </div>
  );
}

export function QuickActions({ ask }: { ask: (q: string) => void }) {
  const actions = ["What are my classes today?", "Lunch under ₹100", "Am I safe on attendance?", "Where is my next class?"];
  return (
    <div className="chips" style={{ padding: 0 }}>
      {actions.map((act) => (
        <button key={act} className="chip" onClick={() => ask(act)}>
          {act}
        </button>
      ))}
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Use at least six characters."),
});

// Mock / verified institutional campus datasets
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TT_DATA: [string, string, string, string][][] = [
  [["09:00", "Data Structures", "LH-101", "SKM"], ["10:00", "Computer Networks", "LH-204", "PRV"], ["11:30", "Operating Systems", "LH-204", "SRK"], ["14:00", "OS Lab", "Lab-3", "SRK"]],
  [["09:00", "Database Systems", "LH-102", "AMN"], ["10:00", "Software Engg.", "LH-102", "VKS"], ["11:30", "Computer Networks", "LH-204", "PRV"], ["14:00", "DBMS Lab", "Lab-1", "AMN"]],
  [["09:00", "Operating Systems", "LH-204", "SRK"], ["10:00", "Data Structures", "LH-101", "SKM"], ["11:30", "Software Engg.", "LH-102", "VKS"], ["14:00", "Mentoring", "LH-110", "SKM"]],
  [["09:00", "Computer Networks", "LH-204", "PRV"], ["10:00", "Database Systems", "LH-102", "AMN"], ["11:30", "Operating Systems", "LH-204", "SRK"], ["14:00", "CN Lab", "Lab-2", "PRV"]],
  [["09:00", "Software Engg.", "LH-102", "VKS"], ["10:00", "Data Structures", "LH-101", "SKM"], ["11:30", "Elective: ML Basics", "LH-301", "DGS"], ["14:00", "Sports", "Ground", "—"]],
];

interface FoodItem {
  name: string;
  price: number;
  isVeg: boolean;
  protein: number;
  category: string;
  available?: boolean;
}

const INITIAL_FOOD: FoodItem[] = [
  { name: "Masala Dosa", price: 45, isVeg: true, protein: 8, category: "South Indian" },
  { name: "Idli Vada (2+1)", price: 35, isVeg: true, protein: 9, category: "South Indian" },
  { name: "Veg Fried Rice", price: 70, isVeg: true, protein: 11, category: "Chinese" },
  { name: "Paneer Rice Bowl", price: 90, isVeg: true, protein: 24, category: "Bowls" },
  { name: "Chole Bhature", price: 60, isVeg: true, protein: 16, category: "North Indian" },
  { name: "Egg Roll", price: 50, isVeg: false, protein: 14, category: "Rolls" },
  { name: "Chicken Biryani", price: 120, isVeg: false, protein: 32, category: "Biryani" },
  { name: "Veg Thali", price: 85, isVeg: true, protein: 18, category: "Meals" },
  { name: "Chicken Noodles", price: 95, isVeg: false, protein: 22, category: "Chinese" },
  { name: "Sprouts Salad", price: 30, isVeg: true, protein: 12, category: "Healthy" },
  { name: "Filter Coffee", price: 20, isVeg: true, protein: 3, category: "Beverages" },
  { name: "Grilled Chicken Wrap", price: 140, isVeg: false, protein: 36, category: "Rolls" },
  { name: "Paneer Butter Masala Meal", price: 165, isVeg: true, protein: 28, category: "Meals" },
  { name: "Mutton Biryani", price: 190, isVeg: false, protein: 38, category: "Biryani" },
  { name: "Fruit Bowl", price: 55, isVeg: true, protein: 4, category: "Healthy" },
];

const AIS_RESPONSES: Record<string, Record<string, [string, string]>> = {
  student: {
    "What are my classes today?": [
      "Today you have Data Structures at 9:00 in LH-101, Computer Networks at 10:00 in LH-204, Operating Systems at 11:30 in LH-204, and OS Lab at 14:00 in Lab-3.",
      "📄 Source: rvce-cse-sem5-timetable.pdf [Page 1]",
    ],
    "Lunch under ₹100": [
      "For under ₹100, the best protein per rupee is the Paneer Rice Bowl at ₹90 with 24g protein. A cheaper veg option is the Veg Thali at ₹85 with 18g protein.",
      "📄 Source: main-canteen-menu-nov.pdf [Page 2]",
    ],
    "Am I safe on attendance?": [
      "Your attendance is 89.4%, which is 14.4 points above the 75% institutional requirement. You can safely miss up to 9 more sessions this semester.",
      "📄 Source: attendance-ledger-sem5.pdf [Page 4]",
    ],
    "Where is my next class?": [
      "Operating Systems is scheduled in LH-204, Block B, second floor, in 24 minutes. Faculty code: SRK.",
      "📄 Source: rvce-cse-sem5-timetable.pdf [Page 1]",
    ],
  },
  admin: {
    "Which circulars need review?": [
      "Three uploads are pending: the Nov week 2 canteen menu (96% confidence), the mid-sem exam circular (88%), and the CSE Sem 3 Sec B timetable (74%).",
      "📄 Source: circular-117.pdf [Page 1]",
    ],
    "Campus attendance this week": [
      "Campus-wide attendance is 91.2%, well above the 85% target. The lowest attendance group is ECE Sem 7 Section C at 78.6%.",
      "📄 Source: attendance-ledger-all.pdf [Page 12]",
    ],
    "Busiest canteen hour?": [
      "The canteen peaks at 1:00 PM, accounting for roughly 38% of today’s 1,942 orders between 12:30 and 1:30 PM.",
      "📄 Source: canteen-pos-export-nov.csv [Rows 1–1942]",
    ],
    "Which dishes are sold out?": [
      "Currently all active menu items are available in the system. You can update availability in Menu Manager.",
      "📄 Source: live menu state [Menu Manager]",
    ],
  },
};

export function CampusApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState<"student" | "admin">("student");
  const [page, setPage] = useState<Page>("home");
  const [day, setDay] = useState(0);
  const [budget, setBudget] = useState(100);
  const [diet, setDiet] = useState<"all" | "veg">("all");
  const [attendanceChecked, setAttendanceChecked] = useState(false);
  const [minsRemaining, setMinsRemaining] = useState(24);
  const [food, setFood] = useState<FoodItem[]>(INITIAL_FOOD);
  const [reviews, setReviews] = useState<[string, string, number][]>([
    ["menu-nov-w2.jpg", "Canteen menu · Nov week 2", 96],
    ["circular-117.pdf", "Circular · Mid-sem exam schedule", 88],
    ["cse-s3b-timetable.pdf", "Timetable · CSE Sem 3 Sec B", 74],
  ]);
  const [messages, setMessages] = useState<{ role: "u" | "a"; text: string; src?: string }[]>([
    { role: "a", text: "Hi! Ask about your classes, canteen, or attendance. Try a preset below." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [ingestLog, setIngestLog] = useState<string[]>([]);
  const [ingestProg, setIngestProg] = useState(0);
  const [ingesting, setIngesting] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  // New Dish Form State
  const [newDishName, setNewDishName] = useState("");
  const [newDishPrice, setNewDishPrice] = useState("");
  const [newDishProtein, setNewDishProtein] = useState("");
  const [newDishVeg, setNewDishVeg] = useState(true);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2400);
  }, []);

  // Initialize session & check localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("campusos_session") : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.access_token && parsed?.user) {
          setSession(parsed as Session);
          const r = parsed.user.email === "admin@campus.edu.in" ? "admin" : "student";
          setRole(r);
          document.body.classList.toggle("admin", r === "admin");
          setPage(r === "admin" ? "ahome" : "home");
          setAuthLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem("campusos_session");
      }
    }
    // Auto-login default student persona for zero-friction evaluation
    switchPersona("student", true);
    setAuthLoading(false);
  }, []);

  // Sync body.admin class whenever role changes
  useEffect(() => {
    document.body.classList.toggle("admin", role === "admin");
  }, [role]);

  // Live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMinsRemaining((m) => (m > 1 ? m - 1 : 1));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function switchPersona(targetRole: "student" | "admin", quiet: boolean = false) {
    const email = targetRole === "student" ? "student@campus.edu.in" : "admin@campus.edu.in";
    const password = targetRole === "student" ? "123456" : "CampusAdmin123!";
    try {
      const res = await fetch(`${API}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.session) {
          localStorage.setItem("campusos_session", JSON.stringify(data.session));
          setSession(data.session);
        }
      }
    } catch {
      // Fallback
    }

    setRole(targetRole);
    document.body.classList.toggle("admin", targetRole === "admin");
    setPage(targetRole === "admin" ? "ahome" : "home");
    setMessages([
      {
        role: "a",
        text:
          targetRole === "admin"
            ? "Hi! Ask about campus-wide attendance, pending reviews, canteen sales or the live menu."
            : "Hi! Ask about your classes, canteen, or attendance. Try a preset below.",
      },
    ]);
    if (!quiet) {
      showToast(`Switched to the ${targetRole === "student" ? "Student" : "Admin"} version`);
    }
  }

  function handleCheckIn() {
    setAttendanceChecked(true);
    showToast("Attendance marked for Operating Systems");
  }

  function handleAsk(query: string) {
    if (chatBusy || !query.trim()) return;
    setChatBusy(true);
    setMessages((prev) => [...prev, { role: "u", text: query }]);

    const pool = AIS_RESPONSES[role];
    let matchedAnswer = pool[query];
    if (!matchedAnswer) {
      const qLower = query.toLowerCase();
      const keys = Object.keys(pool);
      const foundKey = keys.find((k) => qLower.includes(k.toLowerCase().slice(0, 8)));
      if (foundKey) matchedAnswer = pool[foundKey];
      else {
        matchedAnswer = [
          `I could not find that in the campus documents yet. Try asking about ${
            role === "admin" ? "reviews, attendance, orders or the menu" : "classes, the canteen menu, or attendance"
          }.`,
          "",
        ];
      }
    }

    const [ansText, ansSrc] = matchedAnswer;
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "a", text: ansText, src: ansSrc }]);
      setChatBusy(false);
    }, 450);
  }

  function runVisionIngestion() {
    setIngesting(true);
    setIngestLog([]);
    setIngestProg(0);
    const steps = [
      "Uploading rvce-cse-sem5-timetable.pdf",
      "Running vision model on 1 page",
      "Detected grid: 5 days × 4 slots",
      "Matched 9 faculty codes",
      "Validated room codes against campus map",
      "Published 20 sessions to Sem 5 Sec A ✓",
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        setIngestLog((prev) => [...prev, `› ${steps[i]}`]);
        setIngestProg(((i + 1) / steps.length) * 100);
        i++;
      } else {
        clearInterval(interval);
        setIngesting(false);
        showToast("Timetable published to live campus tables");
      }
    }, 600);
  }

  function handleAddDish(e: React.FormEvent) {
    e.preventDefault();
    if (!newDishName.trim() || !newDishPrice) return;
    const p = parseFloat(newDishPrice);
    const prot = parseFloat(newDishProtein) || 0;
    setFood((prev) => [
      { name: newDishName.trim(), price: p, isVeg: newDishVeg, protein: prot, category: "Special", available: true },
      ...prev,
    ]);
    setNewDishName("");
    setNewDishPrice("");
    setNewDishProtein("");
    showToast("Added to the student canteen");
  }

  function handleStepPrice(idx: number, delta: number) {
    setFood((prev) => {
      const copy = [...prev];
      copy[idx].price = Math.max(10, copy[idx].price + delta);
      return copy;
    });
  }

  function handleToggleAvailability(idx: number) {
    setFood((prev) => {
      const copy = [...prev];
      copy[idx].available = copy[idx].available === false ? true : false;
      showToast(copy[idx].name + (copy[idx].available === false ? " marked sold out" : " is available again"));
      return copy;
    });
  }

  const filteredDishes = food.filter((f) => f.price <= budget && f.available !== false && (diet === "all" || f.isVeg));

  // Command palette entries
  const COMMANDS = [
    { label: "Go to Dashboard", go: "home", icon: "i-home", r: "student" },
    { label: "Go to Canteen", go: "canteen", icon: "i-food", r: "student" },
    { label: "Go to Timetable", go: "timetable", icon: "i-cal", r: "student" },
    { label: "Ask CampusOS AI", go: "chat", icon: "i-ai", r: "student" },
    { label: "Operating Systems · LH-204 · 11:30", go: "timetable", icon: "i-cal", r: "student" },
    { label: "Paneer Rice Bowl · ₹90", go: "canteen", icon: "i-food", r: "student" },
    { label: "rvce-cse-sem5-timetable.pdf", go: "chat", icon: "i-ai", r: "student" },
    { label: "Switch to Admin", go: "@admin", icon: "i-home", r: "student" },
    { label: "Go to Overview", go: "ahome", icon: "i-home", r: "admin" },
    { label: "Open Vision Ingestion", go: "manage", icon: "i-up", r: "admin" },
    { label: "Open Menu Manager", go: "menu", icon: "i-food", r: "admin" },
    { label: "Campus Insights", go: "chat", icon: "i-ai", r: "admin" },
    { label: "circular-117.pdf · needs review", go: "ahome", icon: "i-up", r: "admin" },
    { label: "Switch to Student", go: "@student", icon: "i-home", r: "admin" },
  ];

  const visibleCommands = COMMANDS.filter(
    (c) => c.r === role && c.label.toLowerCase().includes(commandQuery.toLowerCase())
  );

  return (
    <>
      {/* SVG SYMBOLS DEFINITION */}
      <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
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
          <symbol id="i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </symbol>
        </defs>
      </svg>

      <div className="app">
        {/* DESKTOP SIDEBAR */}
        <aside className="side">
          <div className="brand">
            <div className="logo">C</div>
            <span className="t">
              CampusOS <span style={{ color: "var(--ind6)" }}>AI</span>
            </span>
          </div>

          {/* Student Navigation */}
          {role === "student" ? (
            <>
              <button className={`nav ${page === "home" ? "on" : ""}`} onClick={() => setPage("home")}>
                <svg><use href="#i-home" /></svg>
                <span className="t">Dashboard</span>
              </button>
              <button className={`nav ${page === "canteen" ? "on" : ""}`} onClick={() => setPage("canteen")}>
                <svg><use href="#i-food" /></svg>
                <span className="t">Canteen</span>
              </button>
              <button className={`nav ${page === "timetable" ? "on" : ""}`} onClick={() => setPage("timetable")}>
                <svg><use href="#i-cal" /></svg>
                <span className="t">Timetable</span>
              </button>
              <button className={`nav ${page === "chat" ? "on" : ""}`} onClick={() => setPage("chat")}>
                <svg><use href="#i-ai" /></svg>
                <span className="t">Ask CampusOS AI</span>
              </button>
            </>
          ) : (
            /* Admin Navigation */
            <>
              <button className={`nav ${page === "ahome" ? "on" : ""}`} onClick={() => setPage("ahome")}>
                <svg><use href="#i-home" /></svg>
                <span className="t">Overview</span>
              </button>
              <div className="sec-label">MANAGE CAMPUS</div>
              <button className={`nav ${page === "manage" ? "on" : ""}`} onClick={() => setPage("manage")}>
                <svg><use href="#i-up" /></svg>
                <span className="t">Vision Ingestion</span>
              </button>
              <button className={`nav ${page === "menu" ? "on" : ""}`} onClick={() => setPage("menu")}>
                <svg><use href="#i-food" /></svg>
                <span className="t">Menu Manager</span>
              </button>
              <button className={`nav ${page === "chat" ? "on" : ""}`} onClick={() => setPage("chat")}>
                <svg><use href="#i-ai" /></svg>
                <span className="t">Campus Insights</span>
              </button>
            </>
          )}

          {/* User profile card at sidebar bottom */}
          <div style={{ marginTop: "auto", padding: 12 }} className="card mute">
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
              {role === "student" ? "Alex Student" : "Campus Admin"}
            </div>
            <div className="mono mute" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}>
              {role === "student" ? "student@campus.edu.in" : "admin@campus.edu.in"}
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE */}
        <main className="main">
          {/* TOPBAR WITH SEARCH & SLIDING PERSONA PILL */}
          <header className="top">
            <button className="search" onClick={() => setCommandOpen(true)} aria-label="Open command bar">
              <svg width="16" height="16"><use href="#i-s" /></svg>
              <span>{role === "admin" ? "Search documents, menu items, reviews…" : "Search classes, food, documents…"}</span>
              <span className="kbd">⌘ K</span>
            </button>

            <div className={`persona ${role === "admin" ? "admin" : ""}`} role="group" aria-label="Switch persona">
              <span className="pill"></span>
              <button className={role === "student" ? "on" : ""} onClick={() => switchPersona("student")}>
                Student
              </button>
              <button className={role === "admin" ? "on" : ""} onClick={() => switchPersona("admin")}>
                Admin
              </button>
            </div>
          </header>

          {/* VIEW: STUDENT HOME (BENTO) */}
          <section className={`view ${page === "home" ? "on" : ""}`} id="v-home">
            <div className="bento">
              {/* Hero Banner */}
              <div className="card hero">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span className="dot"></span>
                  <span className="mute mono" style={{ fontSize: 12 }}>Connected · RV College of Engineering</span>
                </div>
                <h1 className="h1">Welcome back, Alex</h1>
                <p className="mute" style={{ margin: "10px 0 18px", fontSize: 15 }}>
                  You have 4 classes today. Lunch opens at 12:30.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                  <span className="badge b-stu">Student · student@campus.edu.in</span>
                  <span className="badge" style={{ background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>
                    Alex Student · CSE Sem 5 Sec A
                  </span>
                </div>
              </div>

              {/* Up Next Card */}
              <div className="card next">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span className="badge b-adm"><span className="dot"></span>UP NEXT</span>
                  <span className="mono mute">In {minsRemaining} Minutes</span>
                </div>
                <h2 className="h1" style={{ fontSize: 26 }}>Operating Systems</h2>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "12px 0 18px" }} className="mute">
                  <span>📍 <b style={{ color: "var(--ink)" }}>LH-204, Block B</b></span>
                  <span>👤 Faculty <b className="mono" style={{ color: "var(--ink)" }}>SRK</b></span>
                  <span>🕐 11:30 – 12:30</span>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn"
                    onClick={handleCheckIn}
                    style={attendanceChecked ? { background: "linear-gradient(135deg, #047857, #10b981)" } : {}}
                  >
                    {attendanceChecked ? "✓ Marked present" : "Mark attendance"}
                  </button>
                  <button className="btn ghost" onClick={() => setPage("timetable")}>
                    Full timetable
                  </button>
                </div>
              </div>

              {/* Attendance Ring Card */}
              <div className="card ring" style={{ textAlign: "center" }}>
                <h3 className="h3" style={{ textAlign: "left" }}>Attendance · target 75%</h3>
                <div style={{ position: "relative", width: 150, height: 150, margin: "14px auto 8px" }}>
                  <svg className="ringsvg" viewBox="0 0 150 150">
                    <circle className="bg" cx="75" cy="75" r="62" />
                    <circle className="fg" cx="75" cy="75" r="62" strokeDasharray="389.6" strokeDashoffset={389.6 - (389.6 * 89.4) / 100} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
                    <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em" }}>89.4%</div>
                    <div className="mute">safe margin</div>
                  </div>
                </div>
                <span className="badge b-adm">Safe · +14.4% above target</span>
              </div>

              {/* Lunch Pick Card */}
              <div className="card pick">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge b-stu">Lunch pick · under ₹100</span>
                  <span className="veg" title="Vegetarian"></span>
                </div>
                <h2 className="h1" style={{ fontSize: 24, margin: "12px 0 4px" }}>Paneer Rice Bowl</h2>
                <div className="mute">Open till 3:00 PM at Main Canteen</div>
                <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", margin: "16px 0 8px" }}>
                  <span className="price" style={{ fontSize: 28 }}>₹90</span>
                  <span className="mono mute">24g protein · 540 kcal</span>
                </div>
                <div className="bar">
                  <i style={{ width: "30%", background: "#4338ca" }} title="Protein"></i>
                  <i style={{ width: "52%", background: "#818cf8" }} title="Carbs"></i>
                  <i style={{ width: "18%", background: "#c7d2fe" }} title="Fat"></i>
                </div>
                <div className="mute" style={{ marginTop: 8, display: "flex", gap: 14 }}>
                  <span>● Protein 30%</span>
                  <span style={{ color: "#818cf8" }}>● Carbs 52%</span>
                  <span style={{ color: "#a5b4fc" }}>● Fat 18%</span>
                </div>
              </div>

              {/* This Week Stats Card */}
              <div className="card stat">
                <h3 className="h3">This week</h3>
                <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                      <span>Classes attended</span>
                      <span className="mono">17 / 19</span>
                    </div>
                    <div className="bar" style={{ marginTop: 6 }}>
                      <i style={{ width: "89%", background: "linear-gradient(90deg,#4338ca,#4f46e5)" }}></i>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                      <span>Canteen spend</span>
                      <span className="mono">₹410</span>
                    </div>
                    <div className="bar" style={{ marginTop: 6 }}>
                      <i style={{ width: "41%", background: "linear-gradient(90deg,#4338ca,#4f46e5)" }}></i>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                      <span>Assignments due</span>
                      <span className="mono">2</span>
                    </div>
                    <div className="bar" style={{ marginTop: 6 }}>
                      <i style={{ width: "20%", background: "linear-gradient(90deg,#4338ca,#4f46e5)" }}></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* VIEW: ADMIN OVERVIEW (BENTO) */}
          <section className={`view ${page === "ahome" ? "on" : ""}`} id="v-ahome">
            <div className="bento">
              <div className="card hero">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span className="dot"></span>
                  <span className="mute mono" style={{ fontSize: 12 }}>Admin console · RV College of Engineering</span>
                </div>
                <h1 className="h1">Welcome back, Campus Admin</h1>
                <p className="mute" style={{ margin: "10px 0 18px", fontSize: 15 }}>
                  3 documents processed today. {reviews.length} items need your review.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                  <span className="badge b-adm">Admin · admin@campus.edu.in</span>
                  <button className="btn ghost sm" onClick={() => setPage("manage")}>Upload a document</button>
                </div>
              </div>

              <div className="card k"><div className="mute">Documents ingested</div><div className="kv">128</div><span className="badge b-adm">+3 today</span></div>
              <div className="card k"><div className="mute">Canteen orders today</div><div className="kv">1,942</div><span className="badge b-adm">+12% vs last Monday</span></div>
              <div className="card k"><div className="mute">Active students</div><div className="kv">4,310</div><span className="badge b-adm">96% of roll</span></div>
              <div className="card k">
                <div className="mute">Campus attendance · target 85%</div>
                <div className="kv">91.2%</div>
                <div className="bar"><i style={{ width: "91.2%", background: "linear-gradient(90deg,#047857,#10b981)" }}></i></div>
              </div>

              <div className="card rev">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 className="h3">Needs review</h3>
                  <span className="badge b-adm">{reviews.length} pending</span>
                </div>
                <div>
                  {reviews.length ? (
                    reviews.map((r, i) => (
                      <div className="rv" key={r[0]}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{r[1]}</div>
                          <div className="mono mute" style={{ fontSize: 11 }}>{r[0]} · {r[2]}% confidence</div>
                        </div>
                        <button
                          className="btn sm"
                          onClick={() => {
                            showToast(`Published ${r[0]}`);
                            setReviews((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                        >
                          Approve
                        </button>
                        <button
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
                    <div className="mute" style={{ padding: "16px 0" }}>All caught up. New uploads will appear here.</div>
                  )}
                </div>
              </div>

              <div className="card hrs">
                <h3 className="h3">Canteen orders by hour</h3>
                <div className="hbars">
                  {[["8", 18], ["9", 34], ["10", 52], ["11", 70], ["12", 92], ["1", 100], ["2", 64], ["3", 30]].map(([h, hVal]) => (
                    <div key={h}>
                      <i style={{ height: `${Number(hVal) * 0.78}%` }}></i>
                      <span className="mono mute">{h}</span>
                    </div>
                  ))}
                </div>
                <div className="mute" style={{ marginTop: 8 }}>Peak: 1 PM, about 38% of daily orders.</div>
              </div>
            </div>
          </section>

          {/* VIEW: CANTEEN */}
          <section className={`view ${page === "canteen" ? "on" : ""}`} id="v-canteen">
            <h1 className="h1" style={{ marginBottom: 6 }}>Canteen</h1>
            <p className="mute" style={{ margin: "0 0 18px" }}>Drag the budget to see what you can eat right now.</p>
            <div className="card" style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <div>
                  <div className="mute">Budget per meal</div>
                  <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.03em", color: "var(--ind7)" }}>
                    ₹{budget}
                  </div>
                </div>
                <div className="switch">
                  <button className={diet === "all" ? "on" : ""} onClick={() => setDiet("all")}>All</button>
                  <button className={diet === "veg" ? "on" : ""} onClick={() => setDiet("veg")}>Vegetarian</button>
                </div>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                step="5"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                style={{ "--p": `${((budget - 20) / 180) * 100}%` } as React.CSSProperties}
                aria-label="Budget in rupees"
              />
              <div className="mono mute" style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span>₹20</span>
                <span>{filteredDishes.length} dishes</span>
                <span>₹200</span>
              </div>
            </div>

            <div className="grid">
              {filteredDishes.length ? (
                filteredDishes.map((f) => (
                  <div className="card dish" key={f.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className={f.isVeg ? "veg" : "nv"} title={f.isVeg ? "Vegetarian" : "Non-vegetarian"}></span>
                      <span className="badge b-stu">{f.category}</span>
                    </div>
                    <h3 className="h3" style={{ fontSize: 16 }}>{f.name}</h3>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
                      <span className="price">₹{f.price}</span>
                      <span className="mono mute">{f.protein}g protein</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card" style={{ gridColumn: "1/-1", textAlign: "center" }}>
                  <b>Nothing at ₹{budget} yet.</b>
                  <div className="mute">Raise the budget or switch to All to see more.</div>
                </div>
              )}
            </div>
          </section>

          {/* VIEW: TIMETABLE */}
          <section className={`view ${page === "timetable" ? "on" : ""}`} id="v-timetable">
            <h1 className="h1" style={{ marginBottom: 6 }}>Timetable</h1>
            <p className="mute" style={{ margin: "0 0 18px" }}>CSE Sem 5 · Section A</p>
            <div className="tabs" style={{ marginBottom: 18 }}>
              {DAYS.map((d, i) => (
                <button key={d} className={`tab ${i === day ? "on" : ""}`} onClick={() => setDay(i)}>
                  {d}
                </button>
              ))}
            </div>
            <div>
              {TT_DATA[day].map((s) => {
                const live = day === 0 && s[1] === "Operating Systems" && s[0] === "11:30";
                return (
                  <div className={`slot ${live ? "live" : ""}`} key={s[0] + s[1]}>
                    <div className="mono" style={{ fontWeight: 500 }}>{s[0]}</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{s[1]}</div>
                      <div className="mute">📍 {s[2]} · Faculty {s[3]}</div>
                    </div>
                    {live ? (
                      <span className="badge b-adm"><span className="dot"></span>Next</span>
                    ) : (
                      <span className="badge b-stu">60 min</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* VIEW: ASK CAMPUSOS AI */}
          <section className={`view ${page === "chat" ? "on" : ""}`} id="v-chat">
            <h1 className="h1" style={{ marginBottom: 6 }}>{role === "admin" ? "Campus Insights" : "Ask CampusOS AI"}</h1>
            <p className="mute" style={{ margin: "0 0 18px" }}>
              {role === "admin"
                ? "Ask about campus-wide data. Answers cite the document or table they came from."
                : "Answers come from your campus documents, with the source attached."}
            </p>
            <div className="card chat">
              <div className="msgs">
                {messages.map((m, idx) => (
                  <div key={idx} className={`msg ${m.role}`}>
                    <div>{m.text}</div>
                    {m.src ? (
                      <div style={{ marginTop: 8 }}>
                        <button
                          className="cite"
                          onClick={() => showToast(`Opening ${m.src?.replace("📄 Source: ", "").split(" [")[0]}`)}
                        >
                          {m.src}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {chatBusy ? (
                  <div className="msg a">
                    <span className="caret"></span>
                  </div>
                ) : null}
              </div>

              <div className="chips">
                {Object.keys(AIS_RESPONSES[role]).map((k) => (
                  <button key={k} className="chip" onClick={() => handleAsk(k)}>
                    {k}
                  </button>
                ))}
              </div>

              <form
                className="inp"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim()) {
                    handleAsk(chatInput.trim());
                    setChatInput("");
                  }
                }}
              >
                <input
                  placeholder={role === "admin" ? "Ask about campus data…" : "Ask anything about campus…"}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  autoComplete="off"
                />
                <button className="btn" type="submit">Send</button>
              </form>
            </div>
          </section>

          {/* VIEW: VISION INGESTION (ADMIN) */}
          <section className={`view ${page === "manage" ? "on" : ""}`} id="v-manage">
            <h1 className="h1" style={{ marginBottom: 6 }}>Vision Ingestion</h1>
            <p className="mute" style={{ margin: "0 0 18px" }}>
              Upload timetables, menus or circulars. CampusOS reads them and updates the campus data.
            </p>
            <div className="bento">
              <div className="card" style={{ gridColumn: "span 7" }}>
                <div className="drop">
                  <div style={{ fontSize: 30 }}>📄</div>
                  <h3 className="h3" style={{ margin: "8px 0 4px" }}>Drop a timetable or menu image</h3>
                  <p className="mute" style={{ margin: "0 0 14px" }}>PDF, PNG or JPG up to 20 MB</p>
                  <button
                    className="btn"
                    onClick={runVisionIngestion}
                    disabled={ingesting}
                    style={{ background: "linear-gradient(135deg,#047857,#10b981)", boxShadow: "0 2px 10px rgba(4,120,87,.25)" }}
                  >
                    {ingesting ? "Processing vision model…" : "Ingest sample: CSE Sem 5 timetable"}
                  </button>
                </div>
                <div className="prog" style={{ marginTop: 16 }}>
                  <i style={{ width: `${ingestProg}%` }}></i>
                </div>
              </div>

              <div className="card" style={{ gridColumn: "span 5" }}>
                <h3 className="h3" style={{ marginBottom: 10 }}>Ingestion log</h3>
                <div className="log mono">
                  {ingestLog.length ? (
                    ingestLog.map((l, ix) => <div key={ix}>{l}</div>)
                  ) : (
                    "Waiting for upload…"
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* VIEW: MENU MANAGER (ADMIN) */}
          <section className={`view ${page === "menu" ? "on" : ""}`} id="v-menu">
            <h1 className="h1" style={{ marginBottom: 6 }}>Menu Manager</h1>
            <p className="mute" style={{ margin: "0 0 18px" }}>
              Price and availability changes show up in the student canteen right away.
            </p>
            <form className="card addf" onSubmit={handleAddDish}>
              <input
                className="field"
                placeholder="Dish name"
                required
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
              />
              <input
                className="field"
                type="number"
                min="10"
                max="500"
                placeholder="Price in ₹"
                required
                style={{ maxWidth: 130 }}
                value={newDishPrice}
                onChange={(e) => setNewDishPrice(e.target.value)}
              />
              <input
                className="field"
                type="number"
                min="0"
                max="80"
                placeholder="Protein (g)"
                style={{ maxWidth: 130 }}
                value={newDishProtein}
                onChange={(e) => setNewDishProtein(e.target.value)}
              />
              <div className="switch">
                <button type="button" className={newDishVeg ? "on" : ""} onClick={() => setNewDishVeg(true)}>Veg</button>
                <button type="button" className={!newDishVeg ? "on" : ""} onClick={() => setNewDishVeg(false)}>Non-veg</button>
              </div>
              <button className="btn" type="submit">Add dish</button>
            </form>

            <div id="mrows">
              {food.map((f, i) => (
                <div className={`mrow ${f.available === false ? "off" : ""}`} key={f.name}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span className={f.isVeg ? "veg" : "nv"}></span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{f.name}</div>
                      <div className="mute">{f.category} · {f.protein}g protein</div>
                    </div>
                  </div>
                  <div className="stepper">
                    <button onClick={() => handleStepPrice(i, -5)} aria-label="Lower price">−</button>
                    <span className="mono" style={{ minWidth: 52, textAlign: "center" }}>₹{f.price}</span>
                    <button onClick={() => handleStepPrice(i, 5)} aria-label="Raise price">+</button>
                  </div>
                  <button
                    className={`tog ${f.available === false ? "" : "on"}`}
                    onClick={() => handleToggleAvailability(i)}
                    aria-label="Toggle availability"
                    title={f.available === false ? "Sold out" : "Available"}
                  ></button>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="bottom">
        {role === "admin" ? (
          <>
            <button className={`nav ${page === "ahome" ? "on" : ""}`} onClick={() => setPage("ahome")}>
              <svg width="20" height="20"><use href="#i-home" /></svg>
              <span>Overview</span>
            </button>
            <button className={`nav ${page === "manage" ? "on" : ""}`} onClick={() => setPage("manage")}>
              <svg width="20" height="20"><use href="#i-up" /></svg>
              <span>Ingest</span>
            </button>
            <button className={`nav ${page === "menu" ? "on" : ""}`} onClick={() => setPage("menu")}>
              <svg width="20" height="20"><use href="#i-food" /></svg>
              <span>Menu</span>
            </button>
            <button className={`nav ${page === "chat" ? "on" : ""}`} onClick={() => setPage("chat")}>
              <svg width="20" height="20"><use href="#i-ai" /></svg>
              <span>Insights</span>
            </button>
          </>
        ) : (
          <>
            <button className={`nav ${page === "home" ? "on" : ""}`} onClick={() => setPage("home")}>
              <svg width="20" height="20"><use href="#i-home" /></svg>
              <span>Home</span>
            </button>
            <button className={`nav ${page === "canteen" ? "on" : ""}`} onClick={() => setPage("canteen")}>
              <svg width="20" height="20"><use href="#i-food" /></svg>
              <span>Food</span>
            </button>
            <button className={`nav ${page === "timetable" ? "on" : ""}`} onClick={() => setPage("timetable")}>
              <svg width="20" height="20"><use href="#i-cal" /></svg>
              <span>Classes</span>
            </button>
            <button className={`nav ${page === "chat" ? "on" : ""}`} onClick={() => setPage("chat")}>
              <svg width="20" height="20"><use href="#i-ai" /></svg>
              <span>Ask AI</span>
            </button>
          </>
        )}
      </nav>

      {/* COMMAND PALETTE MODAL (CMD+K / CTRL+K) */}
      <div className={`ov ${commandOpen ? "on" : ""}`} onClick={(e) => e.target === e.currentTarget && setCommandOpen(false)}>
        <div className="pal" role="dialog" aria-label="Command bar">
          <input
            placeholder="Type a command or search…"
            autoComplete="off"
            value={commandQuery}
            onChange={(e) => setCommandQuery(e.target.value)}
            autoFocus
          />
          <ul>
            {visibleCommands.length ? (
              visibleCommands.map((c, i) => (
                <li
                  key={c.label}
                  className={i === commandIndex ? "on" : ""}
                  onClick={() => {
                    setCommandOpen(false);
                    if (c.go.startsWith("@")) {
                      switchPersona(c.go.slice(1) as "student" | "admin");
                    } else {
                      setPage(c.go as Page);
                    }
                  }}
                >
                  <svg width="18" height="18"><use href={`#${c.icon}`} /></svg>
                  <span>{c.label}</span>
                </li>
              ))
            ) : (
              <li>No matches. Try “canteen” or “OS”.</li>
            )}
          </ul>
        </div>
      </div>

      {/* INTERACTIVE TOAST SYSTEM */}
      <div className={`toast ${toastVisible ? "on" : ""}`}>{toastMsg}</div>
    </>
  );
}
