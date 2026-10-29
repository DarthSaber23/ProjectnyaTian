import { Logger } from "@nestjs/common";
import type { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicMediaPolicy } from "./media/policy";
import { S3ObjectStorage, STORAGE_RETRY_MS } from "./storage.service";

type Handler = (input: Record<string, unknown>) => unknown;

/** Stub S3 client: records command names and answers from per-command handlers. */
function stubClient(handlers: Record<string, Handler>) {
  const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const name = command.constructor.name;
      sent.push({ name, input: command.input });
      const handler = handlers[name];
      if (!handler) return {};
      return handler(command.input);
    },
  } as unknown as S3Client;
  return { client, sent };
}

const error = (name: string, status?: number) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("S3ObjectStorage", () => {
  it("(d) ensurePublicMediaPolicy replaces a broader existing policy and verifies the read-back", async () => {
    let stored: string | null = JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: "*", Action: ["s3:GetObject", "s3:ListBucket"], Resource: ["arn:aws:s3:::tian-media/*"] }] });
    const { client } = stubClient({
      PutBucketPolicyCommand: (input) => { stored = input.Policy as string; },
      GetBucketPolicyCommand: () => ({ Policy: stored }),
    });
    const storage = new S3ObjectStorage(client);
    await storage.ensurePublicMediaPolicy();
    expect(JSON.parse(stored!)).toEqual(JSON.parse(publicMediaPolicy("tian-media")));

    const liar = stubClient({ GetBucketPolicyCommand: () => ({ Policy: JSON.stringify({ Version: "2012-10-17", Statement: [] }) }) });
    await expect(new S3ObjectStorage(liar.client).ensurePublicMediaPolicy()).rejects.toThrow();
  });

  it("(e) HeadBucket/CreateBucket/policy calls throwing: onModuleInit resolves, ready=false, one storage_init_failed log with error class and no keys", async () => {
    const logs: string[] = [];
    vi.spyOn(Logger.prototype, "error").mockImplementation((msg: unknown) => { logs.push(String(msg)); });
    vi.spyOn(Logger.prototype, "log").mockImplementation((msg: unknown) => { logs.push(String(msg)); });
    const { client } = stubClient({ HeadBucketCommand: () => { throw error("NetworkingError"); } });
    const storage = new S3ObjectStorage(client);
    await expect(storage.onModuleInit()).resolves.toBeUndefined();
    storage.onModuleDestroy();
    expect(storage.ready).toBe(false);
    const failed = logs.filter((l) => l.includes("storage_init_failed"));
    expect(failed).toHaveLength(1);
    expect(failed[0]).toContain("errorClass=NetworkingError");
    expect(failed[0]).not.toMatch(/key|secret|password/i);
  });

  it("(e) a non-404 HeadBucket error (name 'NetworkingError') never sends CreateBucketCommand; NotFound does", async () => {
    const network = stubClient({ HeadBucketCommand: () => { throw error("NetworkingError"); } });
    await expect(new S3ObjectStorage(network.client).ensureBucket()).rejects.toThrow();
    expect(network.sent.map((s) => s.name)).not.toContain("CreateBucketCommand");

    const missing = stubClient({ HeadBucketCommand: () => { throw error("NotFound", 404); } });
    await new S3ObjectStorage(missing.client).ensureBucket();
    expect(missing.sent.map((s) => s.name)).toContain("CreateBucketCommand");
  });

  it("(e) retries every STORAGE_RETRY_MS until bucket and policy are in place, then ready=true and storage_init_ok logged once", async () => {
    vi.useFakeTimers();
    const logs: string[] = [];
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "log").mockImplementation((msg: unknown) => { logs.push(String(msg)); });
    let up = false;
    let stored: string | null = null;
    const { client } = stubClient({
      HeadBucketCommand: () => { if (!up) throw error("NetworkingError"); },
      PutBucketPolicyCommand: (input) => { stored = input.Policy as string; },
      GetBucketPolicyCommand: () => ({ Policy: stored }),
    });
    const storage = new S3ObjectStorage(client);
    await storage.onModuleInit();
    expect(storage.ready).toBe(false);
    up = true;
    await vi.advanceTimersByTimeAsync(STORAGE_RETRY_MS);
    expect(storage.ready).toBe(true);
    await vi.advanceTimersByTimeAsync(STORAGE_RETRY_MS * 2);
    expect(logs.filter((l) => l.includes("storage_init_ok"))).toHaveLength(1);
    storage.onModuleDestroy();
  });

  it("(f) putObject sends ContentType image/webp as given and exists() maps NotFound to false", async () => {
    const { client, sent } = stubClient({ HeadObjectCommand: (input) => { if (input.Key === "missing") throw error("NotFound", 404); return {}; } });
    const storage = new S3ObjectStorage(client);
    await storage.putObject("media/products/B01/a-480.webp", Buffer.from("x"), "image/webp");
    expect(sent.find((s) => s.name === "PutObjectCommand")!.input).toMatchObject({ Key: "media/products/B01/a-480.webp", ContentType: "image/webp" });
    expect(await storage.exists("present")).toBe(true);
    expect(await storage.exists("missing")).toBe(false);
  });
});
