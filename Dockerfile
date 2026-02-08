FROM node:20

WORKDIR /app

COPY package.json ./package.json

COPY prisma ./prisma
COPY server ./server
COPY shared ./shared
COPY src ./src
COPY static ./static
COPY svelte.config.js ./svelte.config.js
COPY vite.config.ts ./vite.config.ts
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.server.json ./tsconfig.server.json
COPY tsconfig.server.build.json ./tsconfig.server.build.json

RUN npm install
RUN npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["bash", "-c", "\
  npx prisma migrate deploy && \
  npx prisma db seed && \
  node dist/server/main.js \
"]
