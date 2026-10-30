import "reflect-metadata";
import { HttpException, Module, type CallHandler, type ExecutionContext, type INestApplication, type NestInterceptor } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiExceptionFilter } from "../api-exception.filter";
import { AuthService } from "../commerce/auth.service";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { StaffMediaGuard } from "./staff-media.guard";

const reached = vi.hoisted(() => ({ count: 0 }));

/** The real FileInterceptor is replaced by one that only records that it ran, so the test proves the guard runs first. */
vi.mock("@nestjs/platform-express", async (original) => {
  const actual = await original<typeof import("@nestjs/platform-express")>();
  return {
    ...actual,
    FileInterceptor: () =>
      class RecordingInterceptor implements NestInterceptor {
        intercept(_context: ExecutionContext, next: CallHandler) {
          reached.count += 1;
          return next.handle();
        }
      },
  };
});

const roles: Record<string, "owner" | "operations"> = { "Bearer owner": "owner", "Bearer ops": "operations" };
const auth = {
  staff: async (authorization?: string) => {
    const role = authorization ? roles[authorization] : undefined;
    if (!role) throw new HttpException({ code: "UNAUTHORIZED", message: "Sesi tidak berlaku." }, 401);
    return { id: `s_${role}`, name: "Uji", role, email: "u@example.test" };
  },
};

@Module({
  controllers: [MediaController],
  providers: [StaffMediaGuard, { provide: AuthService, useValue: auth }, { provide: MediaService, useValue: { upload: async () => ({}) } }],
})
class GuardOrderModule {}

let app: INestApplication;
let base: string;

beforeAll(async () => {
  app = await NestFactory.create(GuardOrderModule, { logger: false });
  app.useGlobalFilters(new ApiExceptionFilter());
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      await app.listen(0, "127.0.0.1");
      base = await app.getUrl();
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (lastErr) throw lastErr;
});

afterAll(async () => {
  await app?.close();
});

async function post(authorization?: string, bytes = 10 * 1024 * 1024): Promise<number> {
  const form = new FormData();
  form.append("alt", "Foto");
  form.append("rightsConfirmed", "true");
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "foto.jpg");
  const response = await fetch(`${base}/admin/products/B01/images`, { method: "POST", body: form, headers: authorization ? { authorization } : {} });
  await response.arrayBuffer();
  return response.status;
}

describe("guard before Multer", () => {
  it("no session with a 10 MB multipart body gives 401 and the file interceptor never ran", async () => {
    reached.count = 0;
    expect(await post()).toBe(401);
    expect(reached.count).toBe(0);
  });

  it("an Operations session gives 403 without reaching the interceptor; an Owner session reaches it", async () => {
    reached.count = 0;
    expect(await post("Bearer ops")).toBe(403);
    expect(reached.count).toBe(0);
    await post("Bearer owner", 16);
    expect(reached.count).toBe(1);
  });
});
