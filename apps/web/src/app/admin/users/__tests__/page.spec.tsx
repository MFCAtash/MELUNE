import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminUser } from "@melune/types";
import { useLocaleStore } from "@/store/locale-store";

const mocks = vi.hoisted(() => ({
  useAdminUsers: vi.fn(),
  updateRole: { mutateAsync: vi.fn(), isPending: false, variables: undefined as { id: string } | undefined },
  ban: { mutateAsync: vi.fn(), isPending: false, variables: undefined as string | undefined },
  unban: { mutateAsync: vi.fn(), isPending: false, variables: undefined as string | undefined },
}));

vi.mock("@/lib/admin-queries", () => ({
  useAdminUsers: mocks.useAdminUsers,
  useAdminUpdateUserRole: () => mocks.updateRole,
  useAdminBanUser: () => mocks.ban,
  useAdminUnbanUser: () => mocks.unban,
}));

import AdminUsersPage from "../page";

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "user-1",
    email: "amir@example.com",
    username: "amir",
    role: "USER",
    avatarUrl: null,
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    isArtist: false,
    ...overrides,
  };
}

function mockUsersResult(items: AdminUser[], overrides: Partial<{ page: number; totalPages: number }> = {}) {
  mocks.useAdminUsers.mockReturnValue({
    data: { items, page: 1, limit: 20, total: items.length, totalPages: 1, ...overrides },
    isLoading: false,
  });
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    // The page now renders through useTranslation() (Phase 12) instead of
    // hardcoded Persian strings; the default locale is English (see
    // lib/i18n/config.ts), so pin it to Persian here to keep these
    // assertions — written against the admin panel's original, Persian-only
    // UI — meaningful without rewriting every expected string.
    useLocaleStore.setState({ locale: "fa" });
    vi.clearAllMocks();
    mocks.updateRole.isPending = false;
    mocks.updateRole.variables = undefined;
    mocks.ban.isPending = false;
    mocks.ban.variables = undefined;
    mocks.unban.isPending = false;
    mocks.unban.variables = undefined;
    mockUsersResult([makeUser()]);
  });

  it("renders a row for every user returned by useAdminUsers", () => {
    mockUsersResult([makeUser({ id: "u1", username: "amir" }), makeUser({ id: "u2", username: "sara", email: "sara@example.com" })]);
    render(<AdminUsersPage />);

    expect(screen.getByText("amir")).toBeInTheDocument();
    expect(screen.getByText("sara")).toBeInTheDocument();
    expect(screen.getByText("sara@example.com")).toBeInTheDocument();
  });

  it("shows the loading state while useAdminUsers is fetching", () => {
    mocks.useAdminUsers.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminUsersPage />);

    expect(screen.getByText("در حال بارگذاری…")).toBeInTheDocument();
  });

  it("shows the empty-state message when there are no users", () => {
    mockUsersResult([]);
    render(<AdminUsersPage />);

    expect(screen.getByText("کاربری یافت نشد")).toBeInTheDocument();
  });

  it("debounces the search box before calling useAdminUsers with the query", async () => {
    const user = userEvent.setup();
    render(<AdminUsersPage />);
    mocks.useAdminUsers.mockClear();

    await user.type(screen.getByPlaceholderText("جستجوی ایمیل یا نام کاربری…"), "sara");

    // Nothing new fires immediately — the debounce hasn't elapsed yet.
    expect(mocks.useAdminUsers).not.toHaveBeenCalledWith(expect.objectContaining({ q: "sara" }));

    await waitFor(
      () => expect(mocks.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ q: "sara" })),
      { timeout: 1000 },
    );
  });

  it("bans an active user and shows a confirmation message", async () => {
    mockUsersResult([makeUser({ id: "u1", username: "amir", deletedAt: null })]);
    mocks.ban.mutateAsync.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    await user.click(screen.getByRole("button", { name: /مسدودسازی/ }));

    expect(mocks.ban.mutateAsync).toHaveBeenCalledWith("u1");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("amir مسدود شد."));
  });

  it("shows an error message when banning a user fails", async () => {
    mockUsersResult([makeUser({ id: "u1", username: "amir" })]);
    mocks.ban.mutateAsync.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    await user.click(screen.getByRole("button", { name: /مسدودسازی/ }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("خطا در انجام عملیات."));
  });

  it("changes a user's role from the row's select", async () => {
    mockUsersResult([makeUser({ id: "u1", username: "amir", role: "USER" })]);
    mocks.updateRole.mutateAsync.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    await user.selectOptions(screen.getByDisplayValue("کاربر"), "ADMIN");

    expect(mocks.updateRole.mutateAsync).toHaveBeenCalledWith({ id: "u1", role: "ADMIN" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("نقش amir به مدیر تغییر کرد."));
  });
});
