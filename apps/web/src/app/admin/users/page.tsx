"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminUser, Role } from "@melune/types";
import { ApiError } from "@melune/api-client";
import { ShieldBan, ShieldCheck } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { useDebounce } from "@/hooks/use-debounce";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/i18n/translate";
import {
  useAdminBanUser,
  useAdminUnbanUser,
  useAdminUpdateUserRole,
  useAdminUsers,
} from "@/lib/admin-queries";

const ROLE_LABEL_KEYS: Record<Role, TranslationKey> = {
  USER: "admin.users.roleUser",
  ARTIST: "admin.users.roleArtist",
  ADMIN: "admin.users.roleAdmin",
};
const ROLES: Role[] = ["USER", "ARTIST", "ADMIN"];

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 350);
  const [role, setRole] = useState<Role | "">("");
  const [includeBanned, setIncludeBanned] = useState(false);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const params = { q: debouncedQ || undefined, role: role || undefined, includeBanned, page, limit: 20 };
  const { data, isLoading } = useAdminUsers(params);

  const updateRole = useAdminUpdateUserRole();
  const ban = useAdminBanUser();
  const unban = useAdminUnbanUser();

  const busyId =
    (updateRole.isPending && updateRole.variables?.id) ||
    (ban.isPending && ban.variables) ||
    (unban.isPending && unban.variables) ||
    null;

  async function handleRoleChange(user: AdminUser, next: Role) {
    setMessage(null);
    try {
      await updateRole.mutateAsync({ id: user.id, role: next });
      setMessage({
        kind: "success",
        text: t("admin.users.roleChangeSuccess", {
          username: user.username,
          role: t(ROLE_LABEL_KEYS[next]),
        }),
      });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof ApiError ? err.message : t("admin.users.roleChangeError"),
      });
    }
  }

  async function handleToggleBan(user: AdminUser) {
    setMessage(null);
    try {
      if (user.deletedAt) {
        await unban.mutateAsync(user.id);
        setMessage({ kind: "success", text: t("admin.users.unbanSuccess", { username: user.username }) });
      } else {
        await ban.mutateAsync(user.id);
        setMessage({ kind: "success", text: t("admin.users.banSuccess", { username: user.username }) });
      }
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof ApiError ? err.message : t("admin.users.toggleBanError"),
      });
    }
  }

  const columns = useMemo<ColumnDef<AdminUser, any>[]>(
    () => [
      {
        accessorKey: "username",
        header: t("admin.users.columnUser"),
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.username}</div>
            <div className="text-xs text-muted">{row.original.email}</div>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: t("admin.users.columnRole"),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <select
              value={user.role}
              disabled={busyId === user.id}
              onChange={(e) => handleRoleChange(user, e.target.value as Role)}
              className="rounded-lg border border-border bg-surfaceElevated px-2 py-1 text-xs text-foreground disabled:opacity-50"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_LABEL_KEYS[r])}
                </option>
              ))}
            </select>
          );
        },
      },
      {
        id: "isArtist",
        header: t("admin.users.columnArtistProfile"),
        cell: ({ row }) => (row.original.isArtist ? t("admin.users.hasProfile") : "—"),
      },
      {
        id: "status",
        header: t("admin.users.columnStatus"),
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              row.original.deletedAt
                ? "bg-red-500/15 text-red-400"
                : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            {row.original.deletedAt ? t("admin.users.statusBanned") : t("admin.users.statusActive")}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("admin.users.columnJoined"),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("fa-IR"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <button
              type="button"
              disabled={busyId === user.id}
              onClick={() => handleToggleBan(user)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                user.deletedAt
                  ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  : "border-red-500/40 text-red-400 hover:bg-red-500/10"
              }`}
            >
              {user.deletedAt ? <ShieldCheck size={14} /> : <ShieldBan size={14} />}
              {user.deletedAt ? t("admin.users.unban") : t("admin.users.ban")}
            </button>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId, t],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">{t("admin.users.title")}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t("admin.users.searchPlaceholder")}
          className="min-w-[220px] flex-1 rounded-xl border border-border bg-surfaceElevated px-3.5 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role | "");
            setPage(1);
          }}
          className="rounded-xl border border-border bg-surfaceElevated px-3 py-2 text-sm"
        >
          <option value="">{t("admin.users.allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(ROLE_LABEL_KEYS[r])}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={includeBanned}
            onChange={(e) => {
              setIncludeBanned(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-primary"
          />
          {t("admin.users.showBanned")}
        </label>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-xl px-3.5 py-2 text-sm ${
            message.kind === "error" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {message.text}
        </p>
      )}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(u) => u.id}
        isLoading={isLoading}
        emptyMessage={t("admin.users.emptyMessage")}
        pagination={
          data ? { page: data.page, totalPages: data.totalPages, onPageChange: setPage } : undefined
        }
      />
    </div>
  );
}
