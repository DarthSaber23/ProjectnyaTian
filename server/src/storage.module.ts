import { Global, Module } from "@nestjs/common";
import { ObjectStorage, S3ObjectStorage } from "./storage.service";

@Global()
@Module({
  providers: [{ provide: ObjectStorage, useClass: S3ObjectStorage }],
  exports: [ObjectStorage],
})
export class StorageModule {}
