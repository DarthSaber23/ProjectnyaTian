import { HttpException, Inject, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../commerce/auth.service";
import { ROLE_LABEL, can, type Permission } from "../domain/rbac";
import type { MediaActor } from "../media/media.types";

const PERMISSION_KEY = "content:permission";

/** The one permission a route needs. A route without it is refused (deny by default). */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);

type StaffRequest = { headers: Record<string, string | string[] | undefined>; staffActor?: MediaActor };

/**
 * Staff session and the route's permission, before anything else runs (so before Multer reads an upload body).
 * Sets `staffActor` (`Nama (Peran)`) for the audit trail.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: Pick<AuthService, "staff">,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const header = request.headers.authorization;
    const user = await this.auth.staff(Array.isArray(header) ? header[0] : header);
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!permission || !can(user.role, permission)) {
      throw new HttpException({ code: "FORBIDDEN", message: `Peran ${ROLE_LABEL[user.role]} tidak punya izin untuk aksi ini.` }, 403);
    }
    request.staffActor = { id: user.id, label: `${user.name} (${ROLE_LABEL[user.role]})` };
    return true;
  }
}
