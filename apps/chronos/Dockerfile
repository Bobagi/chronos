FROM node:20

WORKDIR /app

COPY package.json ./package.json
COPY apps/chronos/package*.json ./apps/chronos/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace @chronos/backend

COPY packages/shared ./packages/shared
COPY apps/chronos ./apps/chronos

WORKDIR /app/apps/chronos

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["bash", "-c", "\
  npx prisma migrate deploy && \
  npx prisma db seed && \
  node dist/src/main.js \
"]
