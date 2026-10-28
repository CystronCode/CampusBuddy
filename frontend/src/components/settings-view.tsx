"use client";
import { useState } from "react";
import { ShieldCheck, Link2, Mail, CalendarDays } from "lucide-react";
import { type Workspace, useRemote, ErrorBox } from "@/components/campus-app";
import { api, type Job } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Connection {
  provider: string;
  connected: boolean;
  configured: boolean;
}
export function SettingsView({ w }: { w: Workspace }) {
  const [name, setName] = useState(w.profile.name);
  const [interests, setInterests] = useState(w.profile.interests);
  const [diet, setDiet] = useState(w.profile.diet);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const connections = useRemote<Connection[]>("/v1/integrations", w);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/v1/me", w.session, w.tenant, {
        method: "PATCH",
        body: JSON.stringify({ name, interests, diet }),
      });
      setSuccess("Your preferences are saved.");
      w.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect(provider: string) {
    setError("");
    try {
      const result = await api<{ url: string }>(
        `/v1/integrations/${provider}/connect`,
        w.session,
        w.tenant,
        { method: "POST" },
      );
      window.location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function disconnect(provider: string) {
    setError("");
    try {
      await api(`/v1/integrations/${provider}`, w.session, w.tenant, {
        method: "DELETE",
      });
      setSuccess("Connection revoked and local credentials removed.");
      w.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function sync(provider: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ records: number }>(
        `/v1/integrations/${provider}/sync`,
        w.session,
        w.tenant,
        { method: "POST" },
      );
      setSuccess(`Imported ${result.records} authorized record(s).`);
      w.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importEmail() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append(
        "options",
        JSON.stringify({ kind: "emails", department: "All" }),
      );
      const job = await api<Job>("/v1/ingestion/preview", w.session, w.tenant, {
        method: "POST",
        body: form,
      });
      if (job.preview.error_count)
        throw new Error(
          job.preview.errors?.[0]?.message || "Check your email file.",
        );
      await api(`/v1/ingestion/${job.id}/confirm`, w.session, w.tenant, {
        method: "POST",
      });
      setSuccess(
        "Your email import is queued. Keep the worker running, then ask CampusOS about your messages.",
      );
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
          <div className="eyebrow">MAKE YOURSELF AT HOME</div>
          <h1>Settings</h1>
          <p>Your preferences and authorized connections.</p>
        </div>
      </div>
      <ErrorBox message={error || connections.error} />
      {success && (
        <div className="success" role="status">
          {success}
        </div>
      )}
      <section className="panel">
        <h2 style={{ marginBottom: 20 }}>About you</h2>
        <form className="settings-form" onSubmit={save}>
          <div>
            <label htmlFor="preferred-name">Preferred name</label>
            <input
              id="preferred-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="interests">Academic interests</label>
            <input
              id="interests"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              maxLength={500}
            />
          </div>
          <div>
            <label htmlFor="preferred-diet">Dietary preference</label>
            <select
              id="preferred-diet"
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
            >
              <option value="any">No preference</option>
              <option value="vegetarian">Vegetarian</option>
            </select>
          </div>
          <p className="subtle">
            {w.profile.department} · Semester {w.profile.semester} · Section{" "}
            {w.profile.section}. Your administrator manages these academic
            details.
          </p>
          <Button type="submit" disabled={busy}>
            Save preferences
          </Button>
        </form>
      </section>
      <section className="panel section-gap">
        <h2>
          <Link2 size={17} style={{ display: "inline", marginRight: 8 }} />
          Your connections
        </h2>
        <p className="subtle" style={{ marginTop: 10 }}>
          Read-only access. CampusOS never sends or deletes messages or modifies
          your Google calendar.
        </p>
        {connections.data?.map((c) => (
          <div className="connection-row" key={c.provider}>
            <div>
              <strong style={{ fontSize: 14 }}>
                {c.provider === "google_gmail" ? (
                  <Mail
                    size={15}
                    style={{ display: "inline", marginRight: 8 }}
                  />
                ) : (
                  <CalendarDays
                    size={15}
                    style={{ display: "inline", marginRight: 8 }}
                  />
                )}
                {c.provider === "google_gmail" ? "Gmail" : "Google Calendar"}
              </strong>
              <p>
                {c.connected
                  ? "Connected to your account"
                  : c.configured
                    ? "Connect your own authorized account"
                    : "OAuth setup required by the deployment operator"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {c.connected ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => sync(c.provider)}
                    disabled={busy}
                  >
                    Import recent data
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => disconnect(c.provider)}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => connect(c.provider)}>
                  Connect
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="panel section-gap">
        <h2>Import your own email file</h2>
        <p className="subtle" style={{ margin: "10px 0 16px" }}>
          Use an EML file or JSON list containing sender, subject, body and
          received fields. These messages remain private to your account.
        </p>
        <label htmlFor="email-import">Email file</label>
        <input
          id="email-import"
          type="file"
          accept=".eml,.json"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Button
          variant="outline"
          onClick={importEmail}
          disabled={busy || !file}
          style={{ marginTop: 15 }}
        >
          Import authorized messages
        </Button>
      </section>
      <p className="subtle" style={{ marginTop: 20 }}>
        <ShieldCheck size={13} style={{ display: "inline", marginRight: 6 }} />
        Your institution’s membership determines access. You cannot change your
        role from this page.
      </p>
    </>
  );
}
