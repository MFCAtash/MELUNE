import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AdminService } from "./admin.service";
import { AdminUserQueryDto } from "./dto/admin-user-query.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user";

/**
 * Phase 8.2 — Admin panel backend. Every route here requires the ADMIN
 * role (class-level `@Roles`, enforced by the global `RolesGuard` —
 * see AuthModule). Catalog CRUD (songs/albums/artists/genres) already
 * has its own ADMIN-capable endpoints in `catalog/` and isn't
 * duplicated here; this module covers what the catalog controllers
 * don't: cross-cutting dashboard stats and user account management.
 */
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("stats")
  getStats() {
    return this.admin.getStats();
  }

  @Get("users")
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.admin.listUsers(query);
  }

  @Patch("users/:id/role")
  updateRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.admin.updateRole(admin.id, id, dto);
  }

  @Patch("users/:id/ban")
  banUser(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    return this.admin.banUser(admin.id, id);
  }

  @Patch("users/:id/unban")
  unbanUser(@Param("id") id: string) {
    return this.admin.unbanUser(id);
  }
}
