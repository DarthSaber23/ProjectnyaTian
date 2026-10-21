import { HeadBucketCommand, CreateBucketCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class ObjectStorage implements OnModuleInit {
  private readonly client: S3Client;
  readonly bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? "tian-media";
    this.client = new S3Client({
      region: process.env.MINIO_REGION ?? "us-east-1",
      endpoint: process.env.MINIO_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async putText(key: string, body: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain; charset=utf-8",
    }));
  }

  async getText(key: string): Promise<string> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return (await out.Body?.transformToString()) ?? "";
  }
}
