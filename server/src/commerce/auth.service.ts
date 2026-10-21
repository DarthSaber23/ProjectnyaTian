import { HttpException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { evaluateAttempt } from "../domain/auth";
import { addMinutes, toWibIso } from "../domain/time";
import type { StaffRole } from "../domain/types";
import { DEMO_LOGIN, customers, staff } from "../data/fixtures";
import { PrismaService } from "../prisma.service";
import { hashPassword, newToken, sha256, verifyPassword, verifyTotp } from "./crypto";
import { w00Orders } from "./w00-orders";

const SESSION_MINUTES = 60 * 24 * 7;
const DEMO_STAFF_PASSWORD = "demo-staff-2026";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async seedIfEmpty(): Promise<void> {
    if ((await this.prisma.customerAccount.count()) > 0) return;
    const customerHash = hashPassword(DEMO_LOGIN.password);
    const unused = hashPassword("not-a-login");
    for (const customer of customers) {
      await this.prisma.customerAccount.create({
        data: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          passwordHash: customer.email === DEMO_LOGIN.email ? customerHash : unused,
        },
      });
    }
    const staffHash = hashPassword(DEMO_STAFF_PASSWORD);
    for (const person of staff) {
      await this.prisma.staffAccount.create({
        data: {
          id: person.id,
          name: person.name,
          email: person.email,
          role: person.role,
          passwordHash: staffHash,
        },
      });
    }
    for (const order of w00Orders()) {
      await this.prisma.orderRecord.create({
        data: {
          number: order.number,
          storeId: "sambung",
          customerId: order.customerId,
          payload: order as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  async signInCustomer(email: string, password: string): Promise<{ token: string; customerId: string; name: string; email: string }> {
    const now = toWibIso(new Date());
    const account = await this.prisma.customerAccount.findUnique({ where: { email: email.trim().toLowerCase() } });
    const valid = !!account && verifyPassword(password, account.passwordHash);
    const outcome = evaluateAttempt(
      { failures: account?.failedAttempts ?? 0, lockedUntil: account?.lockedUntil ?? undefined },
      valid,
      now,
    );
    if (account) {
      await this.prisma.customerAccount.update({
        where: { id: account.id },
        data: { failedAttempts: outcome.state.failures, lockedUntil: outcome.state.lockedUntil ?? null },
      });
    }
    if (!outcome.ok && outcome.reason === "locked") {
      throw new HttpException({ code: "LOCKED", message: "Terlalu banyak percobaan. Coba lagi nanti.", details: [{ until: outcome.until }] }, 423);
    }
    if (!outcome.ok || !account) {
      const remaining = outcome.ok ? 0 : outcome.reason === "invalid" ? outcome.remaining : 0;
      throw new HttpException({ code: "INVALID_CREDENTIALS", message: "Email atau kata sandi salah.", details: [{ remaining }] }, 401);
    }
    return { ...(await this.issue("customer", account.id)), customerId: account.id, name: account.name, email: account.email };
  }

  async signInStaff(email: string, password: string, totp: string): Promise<{ token: string; staffId: string; name: string; role: StaffRole }> {
    const now = toWibIso(new Date());
    const account = await this.prisma.staffAccount.findUnique({ where: { email: email.trim().toLowerCase() } });
    const secret = process.env.STAFF_TOTP_SECRET ?? "";
    const valid = !!account && !!secret && verifyPassword(password, account.passwordHash) && verifyTotp(secret, totp);
    const outcome = evaluateAttempt(
      { failures: account?.failedAttempts ?? 0, lockedUntil: account?.lockedUntil ?? undefined },
      valid,
      now,
    );
    if (account) {
      await this.prisma.staffAccount.update({
        where: { id: account.id },
        data: { failedAttempts: outcome.state.failures, lockedUntil: outcome.state.lockedUntil ?? null },
      });
    }
    if (!outcome.ok && outcome.reason === "locked") {
      throw new HttpException({ code: "LOCKED", message: "Terlalu banyak percobaan. Coba lagi nanti." }, 423);
    }
    if (!outcome.ok || !account) {
      throw new HttpException({ code: "INVALID_CREDENTIALS", message: "Email, kata sandi, atau kode autentikator salah." }, 401);
    }
    return { ...(await this.issue("staff", account.id)), staffId: account.id, name: account.name, role: account.role as StaffRole };
  }

  async customerId(authorization?: string): Promise<string> {
    return this.subject("customer", authorization);
  }

  async staff(authorization?: string): Promise<{ id: string; name: string; role: StaffRole; email: string }> {
    const id = await this.subject("staff", authorization);
    const account = await this.prisma.staffAccount.findUnique({ where: { id } });
    if (!account) throw new HttpException({ code: "UNAUTHORIZED", message: "Sesi tidak berlaku." }, 401);
    return { id: account.id, name: account.name, role: account.role as StaffRole, email: account.email };
  }

  private async issue(kind: string, subjectId: string): Promise<{ token: string }> {
    const token = newToken();
    await this.prisma.sessionToken.create({
      data: { tokenHash: sha256(token), kind, subjectId, expiresAt: addMinutes(toWibIso(new Date()), SESSION_MINUTES) },
    });
    return { token };
  }

  private async subject(kind: string, authorization?: string): Promise<string> {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new HttpException({ code: "UNAUTHORIZED", message: "Masuk diperlukan." }, 401);
    const row = await this.prisma.sessionToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.kind !== kind || Date.parse(row.expiresAt) < Date.now()) {
      throw new HttpException({ code: "UNAUTHORIZED", message: "Sesi tidak berlaku." }, 401);
    }
    return row.subjectId;
  }

  async signOut(authorization?: string): Promise<{ ok: true }> {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (token) await this.prisma.sessionToken.deleteMany({ where: { tokenHash: sha256(token) } });
    return { ok: true };
  }

  async register(name: string, email: string, password: string): Promise<{ token: string; customerId: string; name: string; email: string }> {
    const normalized = email.trim().toLowerCase();
    if (!name.trim() || !normalized.includes("@") || password.length < 8) {
      throw new HttpException({ code: "VALIDATION", message: "Nama, email, dan kata sandi minimal 8 karakter wajib diisi." }, 422);
    }
    const existing = await this.prisma.customerAccount.findUnique({ where: { email: normalized } });
    if (existing) throw new HttpException({ code: "CONFLICT", message: "Email sudah terdaftar." }, 409);
    const id = `C-${Date.now().toString().slice(-6)}`;
    const account = await this.prisma.customerAccount.create({
      data: { id, name: name.trim(), email: normalized, phone: "", passwordHash: hashPassword(password) },
    });
    return { ...(await this.issue("customer", account.id)), customerId: account.id, name: account.name, email: account.email };
  }

  async forgotPassword(email: string): Promise<{ accepted: true }> {
    const normalized = email.trim().toLowerCase();
    const account = await this.prisma.customerAccount.findUnique({ where: { email: normalized } });
    if (account) {
      const token = newToken();
      await this.prisma.passwordReset.create({
        data: { email: normalized, tokenHash: sha256(token), expiresAt: addMinutes(toWibIso(new Date()), 30) },
      });
    }
    return { accepted: true };
  }

  googleStart(): never {
    throw new HttpException({ code: "NOT_CONFIGURED", message: "Google Sign-In belum dikonfigurasi. Isi GOOGLE_CLIENT_ID di server." }, 501);
  }
}
