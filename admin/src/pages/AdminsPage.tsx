import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { createAdmin, deleteAdmin, fetchAdmins, updateAdmin } from "../services/api";
import { AdminRole, AdminUser } from "../types";

const initialForm = {
  email: "",
  password: "",
  role: "admin" as AdminRole,
};

export default function AdminsPage() {
  const qc = useQueryClient();
  const { admin: currentAdmin } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [passwordReset, setPasswordReset] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: fetchAdmins,
  });

  const createMutation = useMutation({
    mutationFn: createAdmin,
    onSuccess: () => {
      toast.success("Admin created");
      setForm(initialForm);
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: () => toast.error("Could not create admin"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateAdmin>[1] }) =>
      updateAdmin(id, updates),
    onSuccess: () => {
      toast.success("Admin updated");
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: () => toast.error("Could not update admin"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdmin,
    onSuccess: () => {
      toast.success("Admin deleted");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: () => toast.error("Could not delete admin"),
  });

  const admins = data?.admins || [];

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate(form);
  };

  const handlePasswordReset = (admin: AdminUser) => {
    const password = passwordReset[admin.id];

    if (!password) {
      toast.error("Enter a new password");
      return;
    }

    updateMutation.mutate(
      { id: admin.id, updates: { password } },
      {
        onSuccess: () => {
          setPasswordReset((current) => ({ ...current, [admin.id]: "" }));
        },
      }
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">Admins</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage people who can access Quant Admin</p>
      </div>

      <form onSubmit={handleCreate} className="card p-5 mb-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="input"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="w-56">
            <label className="label">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="input"
              required
            />
          </div>

          <div className="w-44">
            <label className="label">Role</label>
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminRole }))}
              className="select"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super admin</option>
            </select>
          </div>

          <button type="submit" disabled={createMutation.isPending} className="btn-primary h-10">
            {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Add admin
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Reset Password</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {admins.map((admin) => {
                const isSelf = admin.id === currentAdmin?.id;

                return (
                  <tr key={admin.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                          <ShieldCheck size={15} className="text-brand-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{admin.email}</p>
                          {isSelf && <p className="text-xs text-zinc-500">You</p>}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={admin.role}
                        disabled={isSelf}
                        onChange={(event) =>
                          updateMutation.mutate({
                            id: admin.id,
                            updates: { role: event.target.value as AdminRole },
                          })
                        }
                        className="select w-40"
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super admin</option>
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        disabled={isSelf}
                        onClick={() =>
                          updateMutation.mutate({
                            id: admin.id,
                            updates: { isActive: !admin.isActive },
                          })
                        }
                        className={`text-xs rounded-lg px-2 py-1 transition ${
                          admin.isActive
                            ? "bg-green-500/10 text-green-400"
                            : "bg-zinc-800 text-zinc-500"
                        } ${isSelf ? "opacity-60 cursor-not-allowed" : "hover:bg-zinc-700"}`}
                      >
                        {admin.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          type="password"
                          value={passwordReset[admin.id] || ""}
                          onChange={(event) =>
                            setPasswordReset((current) => ({
                              ...current,
                              [admin.id]: event.target.value,
                            }))
                          }
                          className="input"
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          onClick={() => handlePasswordReset(admin)}
                          className="btn-ghost whitespace-nowrap"
                        >
                          Save
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {confirmDelete === admin.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(admin.id)}
                              className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg px-2 py-1 transition"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-zinc-500 hover:text-zinc-300 rounded-lg px-2 py-1 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => setConfirmDelete(admin.id)}
                            className="btn-danger p-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete admin"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
