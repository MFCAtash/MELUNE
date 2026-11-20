import { Home, Library, Search, type LucideIcon } from "lucide-react";
import type { NavId } from "@/lib/nav";

export const NAV_ICONS: Record<NavId, LucideIcon> = {
  home: Home,
  search: Search,
  library: Library,
};
