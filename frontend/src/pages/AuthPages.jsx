import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usePageTitle } from "../hooks/useAsync";

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth-art">
        <Logo />
        <h2>Pick up exactly where you stopped.</h2>
        <ul>
          <li>Your progress follows you across devices</li>
          <li>Keep a watch list and favorites</li>
          <li>Comment on episodes and reply to others</li>
        </ul>
      </div>
      <div className="auth-card">
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
        <p className="auth-foot">{footer}</p>
      </div>
    </div>
  );
}

function Field({ label, error, ...props }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input {...props} aria-invalid={!!error} />
      {error && <em className="form-error">{error}</em>}
    </label>
  );
}

function fieldErrors(err) {
  if (err instanceof ApiError && err.data && typeof err.data === "object" && !err.data.detail) {
    return Object.fromEntries(Object.entries(err.data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]));
  }
  return { form: err.message || "Something went wrong. Try again." };
}

export function Login() {
  usePageTitle("Sign in");
  const { user, login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = location.state?.from || "/";
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const u = await login(form.identifier, form.password);
      toast(`Welcome back, ${u.username}.`, "success");
      nav(from, { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Sign in"
      subtitle="Use your username or email."
      footer={<>New here? <Link to="/register" state={location.state}>Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate>
        <Field label="Username or email" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} autoComplete="username" autoFocus required />
        <Field label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" required />
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !form.identifier || !form.password}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </Shell>
  );
}

export function Register() {
  usePageTitle("Create account");
  const { user, register } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = location.state?.from || "/";
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setErrors({ confirm: "Passwords don't match." });
    setBusy(true);
    setErrors({});
    try {
      const u = await register({ username: form.username, email: form.email, password: form.password });
      toast(`Account created. Welcome, ${u.username}.`, "success");
      nav(from, { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Create your account"
      subtitle="It takes a few seconds."
      footer={<>Already have an account? <Link to="/login" state={location.state}>Sign in</Link></>}
    >
      <form onSubmit={submit} noValidate>
        <Field label="Username" value={form.username} onChange={set("username")} error={errors.username} autoComplete="username" autoFocus required />
        <Field label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} autoComplete="email" required />
        <Field label="Password (8+ characters)" type="password" value={form.password} onChange={set("password")} error={errors.password} autoComplete="new-password" required />
        <Field label="Confirm password" type="password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} autoComplete="new-password" required />
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>
    </Shell>
  );
}
