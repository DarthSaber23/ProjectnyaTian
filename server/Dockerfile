FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json vitest.config.ts ./
COPY src ./src

ENV DATABASE_URL=postgresql://user:pass@localhost:5432/tian
RUN npx prisma generate && npm test && npm run build

ENV NODE_ENV=production
EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main.js"]
