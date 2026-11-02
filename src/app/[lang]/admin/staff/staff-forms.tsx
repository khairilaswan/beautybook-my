"use client";

import { useActionState, useState, useTransition } from "react";
import { type ActionState, addStaff, changeStaffRole, removeStaff, saveRole } from "@/app/admin/actions";

type RoleOption = { id: number; name: string };
const input = "rounded-xl border border-line bg-white px-3 py-2";

export function StaffRow({ userId, email, roleId, roles, isMe }: { userId: string; email: string; roleId: number; roles: RoleOption[]; isMe: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3">
      <span>{email}{isMe ? " (you)" : ""}</span>
      <span className="flex items-center gap-2">
        <select
          defaultValue={roleId}
          disabled={pending || isMe}
          onChange={(e) => start(async () => setMessage((await changeStaffRole(userId, Number(e.target.value))).error ?? "Saved"))}
          className={input}
        >
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {!isMe && (
          <button
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Remove ${email} from staff?`)) start(async () => setMessage((await removeStaff(userId)).error ?? "Removed"));
            }}
            className="rounded-full border border-line px-3 py-1"
          >
            Remove
          </button>
        )}
        {message && <span className="text-muted">{message}</span>}
      </span>
    </li>
  );
}

export function AddStaffForm({ roles }: { roles: RoleOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addStaff, {});
  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <input name="email" type="email" required placeholder="name@example.com" className={input} />
      <select name="roleId" required className={input} defaultValue="">
        <option value="" disabled>Role…</option>
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <button disabled={pending} className="rounded-full bg-ink px-4 py-2 text-white disabled:opacity-50">Add staff</button>
      {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
      {state.message && <span className="text-whatsapp">{state.message}</span>}
    </form>
  );
}

type Role = { id: number; name: string; description: string | null; permissions: string[] };

export function RoleForm({ role, permissions }: { role: Role | null; permissions: readonly (readonly [string, string])[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRole, {});
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-line bg-white p-4 text-sm">
      {role && <input type="hidden" name="id" value={role.id} />}
      <input name="name" required defaultValue={role?.name} placeholder="New role name" className={`w-full font-semibold ${input}`} />
      <input name="description" defaultValue={role?.description ?? ""} placeholder="What this role is for" className={`w-full ${input}`} />
      <div className="flex flex-wrap gap-2">
        {permissions.map(([key, label]) => (
          <label key={key} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
            <input type="checkbox" name="permissions" value={key} defaultChecked={role?.permissions.includes(key)} />
            {label}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button disabled={pending} className="rounded-full bg-ink px-3 py-1 text-white disabled:opacity-50">{role ? "Save role" : "Create role"}</button>
        {state.error && <span className="text-brand-700">{state.error}</span>}
        {state.message && <span className="text-whatsapp">{state.message}</span>}
      </div>
    </form>
  );
}
