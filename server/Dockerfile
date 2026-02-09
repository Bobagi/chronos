FROM node:20

WORKDIR /app

COPY package.json ./package.json
COPY nest-cli.json ./nest-cli.json
COPY server ./server
COPY client ./client
COPY shared ./shared

RUN npm install
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build

EXPOSE 3000
EXPOSE 3055

CMD ["npm", "run", "start"]
