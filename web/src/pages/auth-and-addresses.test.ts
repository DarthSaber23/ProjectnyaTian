import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { backend } from "../services/http/backend";

describe("Customer registration, forgot password, and address book CRUD", () => {
  it("backend has register, forgotPassword, and address CRUD methods defined", () => {
    expect(typeof (backend as unknown as { register?: unknown }).register).toBe("function");
    expect(typeof (backend as unknown as { forgotPassword?: unknown }).forgotPassword).toBe("function");
    expect(typeof (backend as unknown as { listAddresses?: unknown }).listAddresses).toBe("function");
    expect(typeof (backend as unknown as { addAddress?: unknown }).addAddress).toBe("function");
    expect(typeof (backend as unknown as { updateAddress?: unknown }).updateAddress).toBe("function");
    expect(typeof (backend as unknown as { deleteAddress?: unknown }).deleteAddress).toBe("function");
  });

  it("SignIn page has registration tab and forgot password trigger", () => {
    const signIn = readFileSync(resolve(__dirname, "SignIn.tsx"), "utf8");
    expect(signIn).toContain("Daftar Akun Baru");
    expect(signIn).toContain("Konfirmasi kata sandi");
    expect(signIn).toContain("Lupa kata sandi");
  });

  it("AddressesPage connects to backend addresses with interactive actions", () => {
    const account = readFileSync(resolve(__dirname, "Account.tsx"), "utf8");
    expect(account).toContain("listAddresses");
    expect(account).toContain("Jadikan utama");
    expect(account).toContain("Tambah alamat");
  });
});
