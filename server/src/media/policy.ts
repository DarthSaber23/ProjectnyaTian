/**
 * Bucket policy for product photos: anonymous read of media/* only (spec section 1). Listing, writes and every
 * other prefix stay private. MinIO may re-format the stored JSON, so the read-back is compared by meaning.
 */
export function publicMediaPolicy(bucket: string): string {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Principal: { AWS: ["*"] }, Action: ["s3:GetObject"], Resource: [`arn:aws:s3:::${bucket}/media/*`] }],
  });
}

const asSet = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : value === undefined ? [] : [String(value)]).sort();

function principals(value: unknown): string[] {
  if (value === "*") return ["*"];
  if (value && typeof value === "object" && "AWS" in value) return asSet((value as { AWS: unknown }).AWS);
  return ["<other>"];
}

export function policyMatches(actual: string, bucket: string): boolean {
  let parsed: { Statement?: unknown };
  try {
    parsed = JSON.parse(actual) as { Statement?: unknown };
  } catch {
    return false;
  }
  const statements = Array.isArray(parsed.Statement) ? parsed.Statement : [];
  if (statements.length !== 1) return false;
  const s = statements[0] as Record<string, unknown>;
  if (s.Effect !== "Allow" || "Condition" in s || "NotAction" in s || "NotResource" in s || "NotPrincipal" in s) return false;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  return same(principals(s.Principal), ["*"]) && same(asSet(s.Action), ["s3:GetObject"]) && same(asSet(s.Resource), [`arn:aws:s3:::${bucket}/media/*`]);
}
