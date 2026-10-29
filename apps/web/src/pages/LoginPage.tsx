import { useState } from "react";
import { signIn, signUp } from "../lib/auth";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setError(null);
    const { error } = await signIn.social({ provider: "google", callbackURL: "/" });
    if (error) {
      setError(
        "Login Google gagal. Pastikan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET sudah diisi di .env (root project)"
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const { error } = await signUp.email({ email, password, name: name || email });
        if (error) throw new Error(error.message ?? "Gagal daftar");
      } else {
        const { error } = await signIn.email({ email, password });
        if (error) throw new Error(error.message ?? "Email atau password salah");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <h1>
          Clicky <span style={{ color: "var(--accent)" }}>Habits</span>
        </h1>
        <p className="sub">
          Habit tracker fisik, jadi digital. Coret kalender atau masukkan koin ke
          toples — tiap kali kebiasaanmu selesai.
        </p>

        <button className="btn btn-primary" onClick={handleGoogle}>
          Masuk dengan Google
        </button>

        <div className="divider">atau pakai email</div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {mode === "register" && (
            <input
              placeholder="Nama"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password (min. 8 karakter)"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {mode === "login" ? "Masuk" : "Daftar"}
          </button>
        </form>

        <button
          className="btn-ghost"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Belum punya akun? Daftar"
            : "Sudah punya akun? Masuk"}
        </button>
      </div>
    </div>
  );
}
