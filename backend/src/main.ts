import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// BigInt cannot be JSON.stringified by default. Patch it globally so every
// response can serialize poisha amounts as strings.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });

  // Reject unexpected / malformed input at the boundary (the brief explicitly
  // calls out "systems may receive unexpected input").
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Swagger. The @nestjs/swagger CLI plugin (enabled in nest-cli.json) reads
  // the DTOs' TS types + class-validator decorators, so request bodies show
  // real fields instead of {}.
  const config = new DocumentBuilder()
    .setTitle('Payflow API')
    .setDescription('Friction-first money movement - PSTU IT Carnival 2026')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, doc);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API on http://localhost:${port}/api  |  Docs: /api/docs`);
}
bootstrap();
