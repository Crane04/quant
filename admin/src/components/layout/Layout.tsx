import { NavLink } from "react-router-dom";
import { FileText, GraduationCap, LayoutDashboard, LogOut, Upload, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/upload", icon: Upload, label: "Upload PDF" },
  { to: "/documents", icon: FileText, label: "Documents" },
  { to: "/students", icon: GraduationCap, label: "Students" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  const visibleNavItems = [
    ...navItems,
    ...(admin?.role === "super_admin" ? [{ to: "/admins", icon: Users, label: "Admins" }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Quant Admin</p>
            <p className="text-xs text-zinc-500">Material Library</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-brand-600/20 text-brand-400"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-zinc-800 space-y-3">
          <div>
            <p className="text-xs text-zinc-400 truncate">{admin?.email}</p>
            <p className="text-xs text-zinc-600 capitalize">
              {admin?.role.replace("_", " ")}
            </p>
          </div>
          <button onClick={logout} className="btn-ghost w-full justify-start px-0 hover:bg-transparent">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-zinc-950">
        {children}
      </main>
    </div>
  );
}
