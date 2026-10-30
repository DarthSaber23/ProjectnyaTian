import { readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

/** Source-level wiring: both sign-in forms use the password field with a show/hide (eye) button. */

const src = resolve(__dirname, "..");
const read = (file: string) => readFileSync(join(src, file), "utf8");

describe("password field with an eye button", () => {
  it("the component toggles the input type and names the button for screen readers", () => {
    const field = read("components/PasswordInput.tsx");
    expect(field).toContain('type={shown ? "text" : "password"}');
    expect(field).toContain('"Sembunyikan kata sandi" : "Tampilkan kata sandi"');
    expect(field).toContain("aria-pressed={shown}");
    expect(field).toContain('type="button"');
    expect(field).toMatch(/h-11 w-11/);
  });

  it.each([
    ["admin/AdminShell.tsx", '<PasswordInput id="a-pw"'],
    ["pages/SignIn.tsx", '<PasswordInput id="password"'],
  ])("%s uses it and has no bare password input left", (file, use) => {
    const source = read(file);
    expect(source).toContain(use);
    expect(source).not.toContain('type="password"');
  });

  it("the customer sign-in page points staff to the admin sign-in", () => {
    expect(read("pages/SignIn.tsx")).toMatch(/<Link to="\/admin\/login"[^>]*>Staf toko\? Masuk di halaman admin<\/Link>/);
  });
});
