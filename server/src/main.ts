import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./api-exception.filter";
import { SecurityInterceptor } from "./security.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new SecurityInterceptor());
  app.setGlobalPrefix("v1", { exclude: ["health"] });
  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
