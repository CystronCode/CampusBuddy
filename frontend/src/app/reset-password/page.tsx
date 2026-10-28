"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/api";
import { Button } from "@/components/ui/button";
export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setReady(!!data.session));
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => listener?.data.subscription.unsubscribe();
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !ready) return;
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(
      error?.message || "Password updated. You can return to CampusOS.",
    );
  }
  return (
    <main className="content">
      <section className="panel settings-form">
        <h1>Choose a new password</h1>
        {!ready && (
          <p>
            Open the recovery link sent to your email before resetting your
            password.
          </p>
        )}
        <form onSubmit={save}>
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            disabled={!ready || password.length < 12}
            style={{ marginTop: 15 }}
          >
            Update password
          </Button>
        </form>
        {message && <p role="status">{message}</p>}
        <a className="text-link" href="/">
          Return to CampusOS
        </a>
      </section>
    </main>
  );
}
