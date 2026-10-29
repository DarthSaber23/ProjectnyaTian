import { HttpException, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { AuthService } from "../commerce/auth.service";
import { ROLE_LABEL, can } from "../domain/rbac";
import type { MediaActor } from "./media.types";

type MediaRequest = { headers: Record<string, string | string[] | undefined>; mediaActor?: MediaActor };

/**
 * Staff session and `products.media` before anything else on a media route. A guard runs before interceptors,
 * so on 401 or 403 the Multer interceptor never reads the upload body into memory.
 */
@Injectable()
export class StaffMediaGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: Pick<AuthService, "staff">) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MediaRequest>();
    const header = request.headers.authorization;
    const user = await this.auth.staff(Array.isArray(header) ? header[0] : header);
    if (!can(user.role, "products.media")) {
      throw new HttpException({ code: "FORBIDDEN", message: `Peran ${ROLE_LABEL[user.role]} tidak punya izin untuk aksi ini.` }, 403);
    }
    request.mediaActor = { id: user.id, label: `${user.name} (${ROLE_LABEL[user.role]})` };
    return true;
  }
}
