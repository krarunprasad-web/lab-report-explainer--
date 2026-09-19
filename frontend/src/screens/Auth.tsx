import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { continueWithGoogle, login, register } from "../lib/api";
import { useAuthStore } from "../state/authStore";

export function Auth() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function afterAuth(needsVerify: boolean, authedEmail: string) {
    if (needsVerify) {
      signIn(authedEmail);
      navigate("/verify");
    } else {
      signIn(authedEmail);
      navigate("/analysing");
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      // Real integration: Google Identity Services returns an ID token client-side.
      // Backend verifies it via google-auth-library before trusting the email.
      const result = await continueWithGoogle("mock-google-id-token");
      if (!result.ok) throw new Error(result.message ?? "Google sign-in failed");
      await afterAuth(result.needsVerify, "you@gmail.com");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(mode: "signin" | "create") {
    if (!email || password.length < 8) {
      setError("Enter your email and a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = mode === "signin" ? await login(email, password) : await register(email, password);
      if (!result.ok) throw new Error(result.message ?? "Couldn't sign you in");
      await afterAuth(result.needsVerify, email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-wide-pad screen-narrow screen-enter">
      <span className="eyebrow">REPORT RECEIVED · STEP 1 OF 2</span>
      <h1 className="h-compact" style={{ marginTop: 10 }}>
        One step before we analyse
      </h1>
      <p className="body-text" style={{ marginTop: 10 }}>
        Results are personal health data, so we confirm it is you before explaining them.
      </p>

      <button className="btn btn-primary" style={{ marginTop: 22 }} onClick={handleGoogle} disabled={busy}>
        Continue with Google
      </button>

      <div className="divider-row">or use email</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="arun@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="at least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="upload-error" style={{ marginTop: 10 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => handleSubmit("signin")} disabled={busy}>
          Sign in
        </button>
        <button className="btn btn-secondary" onClick={() => handleSubmit("create")} disabled={busy}>
          Create account
        </button>
      </div>

      <div className="note-box" style={{ marginTop: 22 }}>
        <span className="note-dot" />
        <span>Your upload is waiting in this session only. Nothing is written to our servers.</span>
      </div>
    </div>
  );
}
