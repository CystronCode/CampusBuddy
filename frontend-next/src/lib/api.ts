import { createClient, type Session } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export const API = (() => {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    // In production browser: if not on localhost, use relative path "" (routes via Next.js proxy)
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "";
    }
  }
  return "http://localhost:8000";
})();

export async function api<T>(
  path: string,
  session: Session,
  tenant: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(API + path, {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "X-Tenant-ID": tenant,
      ...(!(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "The server could not be reached." }));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : "Check your information and try again.",
    );
  }
  return response.json() as Promise<T>;
}
export type DataRecord = {
  id?: string;
  source_id?: string;
  source_ids?: string[];
  demo?: boolean;
  [key: string]: unknown;
};
export interface Citation {
  id: string;
  filename: string;
  demo: boolean;
  created_at: string;
  url: string;
}
export interface Answer {
  answer: string;
  kind: string;
  records: DataRecord[];
  sources: Citation[];
  followups: string[];
  conversation_id: string;
}
export interface Profile {
  user_id: string;
  tenant_id: string;
  name: string;
  role: string;
  department: string;
  semester: number;
  section: string;
  diet: string;
  interests: string;
  institution: string;
  demo: boolean;
  timezone: string;
}
export interface Membership {
  tenant_id: string;
  institution: string;
  role: string;
  name: string;
  demo: boolean;
}
export interface Overview {
  next_class: DataRecord | null;
  classes: DataRecord[];
  notices: DataRecord[];
  events: DataRecord[];
  exams: DataRecord[];
}
export interface Job {
  id: string;
  source_id: string;
  data_type?: string;
  status: string;
  error: string | null;
  attempts: number;
  created_at: string;
  preview: {
    columns?: string[];
    fields?: { name: string; required: boolean }[];
    mapping?: Record<string, string>;
    records?: DataRecord[];
    raw?: DataRecord[];
    errors?: { row: number; message: string }[];
    error_count?: number;
    valid_count?: number;
    imported_count?: number;
    message?: string;
  };
}

export async function streamChat(
  question: string,
  conversation: string | null,
  session: Session,
  tenant: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<Answer> {
  const response = await fetch(API + "/v1/chat/stream", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "X-Tenant-ID": tenant,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, conversation_id: conversation }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.detail || "Could not answer your question. Try again.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming is unavailable. Try again.");
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Answer | undefined;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = event.split("\n").find((line) => line.startsWith("data: "));
      if (!data) continue;
      const payload = JSON.parse(data.slice(6));
      if (event.startsWith("event: delta")) onDelta(payload.text);
      if (event.startsWith("event: result")) result = payload as Answer;
    }
  }
  if (!result)
    throw new Error(
      "The response was interrupted. Your conversation is saved; reopen it to recover.",
    );
  return result;
}

export function campusDate(timezone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}
export function prettyDate(value: unknown) {
  if (!value) return "";
  const s = String(value);
  return new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", weekday: "short" },
  );
}
export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export interface STTResult {
  text: string;
  model: string;
  latency_ms: number;
}

export async function transcribeAudio(audioBlob: Blob): Promise<STTResult> {
  const formData = new FormData();
  let ext = "webm";
  if (audioBlob.type.includes("wav")) ext = "wav";
  else if (audioBlob.type.includes("mp4")) ext = "mp4";
  else if (audioBlob.type.includes("ogg")) ext = "ogg";

  formData.append("file", audioBlob, `speech.${ext}`);

  const res = await fetch(`${API}/v1/audio/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Audio transcription failed." }));
    throw new Error(err.detail || "Audio transcription failed.");
  }

  return (await res.json()) as STTResult;
}
