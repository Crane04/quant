import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2, LockKeyhole } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState("admin@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success("Logged in");
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="mb-8">
          <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center mb-4">
            <LockKeyhole size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">Quant Admin</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to manage materials</p>
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
            Sign in
          </button>
        </div>
      </form>
    </main>
  );
}
