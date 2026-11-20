"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  /** Row identity for React keys — defaults to array index if omitted. */
  getRowId?: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  /** Server-side pagination controls — omit for a single-page table. */
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

/**
 * Thin wrapper around `@tanstack/react-table` shared by every admin list
 * (Users/Songs/Albums). Sorting is client-side (over whatever page of
 * rows is currently loaded); pagination itself is server-side, driven by
 * the `pagination` prop, because the underlying admin/catalog endpoints
 * are already paginated server-side and re-fetching the whole table to
 * sort client-side wouldn't be an improvement.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  emptyMessage,
  pagination,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const resolvedEmptyMessage = emptyMessage ?? t("admin.common.noResults");

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surfaceElevated text-start text-xs uppercase tracking-wide text-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-start font-medium"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp size={12} />
                          ) : sorted === "desc" ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted">
                  {t("admin.common.loadingRows")}
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted">
                  {resolvedEmptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-surface">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted">
          <span>{t("admin.common.pageOf", { page: pagination.page, totalPages: pagination.totalPages })}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"
              aria-label={t("admin.common.prevPage")}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"
              aria-label={t("admin.common.nextPage")}
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
