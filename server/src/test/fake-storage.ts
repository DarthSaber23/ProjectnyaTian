import { ObjectStorage } from "../storage.service";

const unavailable = () => Object.assign(new Error("fake storage unavailable"), { name: "ServiceUnavailable" });

/** In-memory ObjectStorage for tests, with switches to fail the Nth put, every call, or deletes only. */
export class FakeStorage extends ObjectStorage {
  readonly bucket = "tian-media";
  objects = new Map<string, { body: Buffer; contentType: string }>();
  policy: string | null = null;
  failNthPut?: number;
  failAll = false;
  failDeletes = false;
  deleteCalls: string[][] = [];
  private puts = 0;

  constructor() {
    super();
    this.ready = true;
  }

  private guard(): void {
    if (this.failAll) throw unavailable();
  }

  async ensureBucket(): Promise<void> { this.guard(); }

  async putText(key: string, body: string): Promise<void> {
    this.guard();
    this.objects.set(key, { body: Buffer.from(body), contentType: "text/plain; charset=utf-8" });
  }

  async getText(key: string): Promise<string> {
    this.guard();
    return this.objects.get(key)?.body.toString() ?? "";
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.guard();
    this.puts += 1;
    if (this.failNthPut === this.puts) throw unavailable();
    this.objects.set(key, { body, contentType });
  }

  async deleteObjects(keys: string[]): Promise<void> {
    this.guard();
    this.deleteCalls.push([...keys]);
    if (this.failDeletes) throw unavailable();
    for (const key of keys) this.objects.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    this.guard();
    return this.objects.has(key);
  }

  async putBucketPolicy(json: string): Promise<void> {
    this.guard();
    this.policy = json;
  }

  async getBucketPolicy(): Promise<string | null> {
    this.guard();
    return this.policy;
  }
}

export function fakeStorage(): FakeStorage {
  return new FakeStorage();
}
