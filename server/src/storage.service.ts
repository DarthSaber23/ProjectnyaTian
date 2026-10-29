import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetBucketPolicyCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { policyMatches, publicMediaPolicy } from "./media/policy";

export const S3_CLIENT = Symbol("S3_CLIENT");
export const STORAGE_RETRY_MS = 30_000;
const INIT_ATTEMPT_CAP_MS = 5_000;

/** The only way media code reaches the bucket, so tests can swap in an in-memory store (spec section 1). */
export abstract class ObjectStorage {
  abstract readonly bucket: string;
  ready = false;
  lastErrorClass?: string;

  /** One attempt: bucket, then the public media policy. Sets `ready`. */
  async init(): Promise<boolean> {
    try {
      await this.ensureBucket();
      await this.ensurePublicMediaPolicy();
      this.ready = true;
      this.lastErrorClass = undefined;
    } catch (error) {
      this.ready = false;
      this.lastErrorClass = error instanceof Error ? error.name : "UnknownError";
    }
    return this.ready;
  }

  /** Writes the media policy (replacing any other), reads it back and throws unless it means the same. */
  async ensurePublicMediaPolicy(): Promise<void> {
    await this.putBucketPolicy(publicMediaPolicy(this.bucket));
    const stored = await this.getBucketPolicy();
    if (!stored || !policyMatches(stored, this.bucket)) {
      throw Object.assign(new Error("Bucket policy read-back does not match"), { name: "PolicyMismatch" });
    }
  }

  abstract ensureBucket(): Promise<void>;
  abstract putText(key: string, body: string): Promise<void>;
  abstract getText(key: string): Promise<string>;
  abstract putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract deleteObjects(keys: string[]): Promise<void>;
  abstract exists(key: string): Promise<boolean>;
  abstract putBucketPolicy(json: string): Promise<void>;
  abstract getBucketPolicy(): Promise<string | null>;
}

const isNotFound = (error: unknown) =>
  error instanceof Error && (error.name === "NotFound" || error.name === "NoSuchKey" || error.name === "NoSuchBucket" || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404);

@Injectable()
export class S3ObjectStorage extends ObjectStorage implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("ObjectStorage");
  private readonly client: S3Client;
  private retry?: NodeJS.Timeout;
  readonly bucket: string;

  constructor(@Optional() @Inject(S3_CLIENT) client?: S3Client) {
    super();
    this.bucket = process.env.MINIO_BUCKET ?? "tian-media";
    this.client = client ?? new S3Client({
      region: process.env.MINIO_REGION ?? "us-east-1",
      endpoint: process.env.MINIO_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY ?? "", secretAccessKey: process.env.MINIO_SECRET_KEY ?? "" },
    });
  }

  /** Never blocks start-up on MinIO: checkout must keep working while photos are unavailable. */
  async onModuleInit(): Promise<void> {
    await this.attempt();
    if (!this.ready) this.scheduleRetry();
  }

  onModuleDestroy(): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = undefined;
  }

  private async attempt(): Promise<void> {
    const capped = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), INIT_ATTEMPT_CAP_MS).unref?.());
    const ok = await Promise.race([this.init(), capped]);
    if (ok) {
      this.logger.log("event=storage_init_ok");
    } else {
      this.logger.error(`event=storage_init_failed errorClass=${this.lastErrorClass ?? "Timeout"}`);
    }
  }

  private scheduleRetry(): void {
    this.retry = setTimeout(() => {
      void this.attempt().then(() => {
        if (!this.ready) this.scheduleRetry();
        else this.retry = undefined;
      });
    }, STORAGE_RETRY_MS);
    this.retry.unref?.();
  }

  /** Creates the bucket only when it is truly missing; any other error means storage is unavailable. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async putText(key: string, body: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: "text/plain; charset=utf-8" }));
  }

  async getText(key: string): Promise<string> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return (await out.Body?.transformToString()) ?? "";
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async deleteObjects(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      const out = await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }));
      if (out?.Errors?.length) throw Object.assign(new Error(`Could not delete ${out.Errors.length} object(s)`), { name: "DeleteFailed" });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async putBucketPolicy(json: string): Promise<void> {
    await this.client.send(new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: json }));
  }

  async getBucketPolicy(): Promise<string | null> {
    try {
      const out = await this.client.send(new GetBucketPolicyCommand({ Bucket: this.bucket }));
      return out?.Policy ?? null;
    } catch (error) {
      if (isNotFound(error) || (error instanceof Error && error.name === "NoSuchBucketPolicy")) return null;
      throw error;
    }
  }
}
