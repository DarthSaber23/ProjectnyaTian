import { describe, expect, it } from "vitest";
import { policyMatches, publicMediaPolicy } from "./policy";

const base = () => JSON.parse(publicMediaPolicy("tian-media"));

describe("publicMediaPolicy", () => {
  it("builds the single read-only statement", () => {
    expect(base()).toEqual({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: { AWS: ["*"] }, Action: ["s3:GetObject"], Resource: ["arn:aws:s3:::tian-media/media/*"] }] });
  });
});

describe("policyMatches", () => {
  it("compares by meaning: string vs array, principal '*' vs {AWS:'*'}", () => {
    const reformatted = { Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: "*", Action: "s3:GetObject", Resource: "arn:aws:s3:::tian-media/media/*" }] };
    expect(policyMatches(JSON.stringify(reformatted), "tian-media")).toBe(true);
    expect(policyMatches(JSON.stringify({ ...reformatted, Statement: [{ ...reformatted.Statement[0], Principal: { AWS: "*" } }] }), "tian-media")).toBe(true);
    expect(policyMatches(publicMediaPolicy("tian-media"), "tian-media")).toBe(true);
  });

  const broken: Array<[string, unknown]> = [
    ["s3:ListBucket extra action", (() => { const p = base(); p.Statement[0].Action.push("s3:ListBucket"); return p; })()],
    ["Resource arn:aws:s3:::tian-media/*", (() => { const p = base(); p.Statement[0].Resource = ["arn:aws:s3:::tian-media/*"]; return p; })()],
    ["second statement", (() => { const p = base(); p.Statement.push({ ...p.Statement[0] }); return p; })()],
    ["Effect Deny", (() => { const p = base(); p.Statement[0].Effect = "Deny"; return p; })()],
    ["a Condition block", (() => { const p = base(); p.Statement[0].Condition = { Bool: { "aws:SecureTransport": "true" } }; return p; })()],
    ["invalid JSON", "{not json"],
  ];
  it.each(broken)("rejects %s", (_name, policy) => {
    expect(policyMatches(typeof policy === "string" ? policy : JSON.stringify(policy), "tian-media")).toBe(false);
  });
});
