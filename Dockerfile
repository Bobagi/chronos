# 1. Base
FROM node:20

WORKDIR /app

# 2. Instalar dependências
COPY package*.json ./
RUN npm install

# 3. Copiar todo o projeto (src, prisma, etc.)
COPY . .

# 4. Gerar Prisma Client
RUN npx prisma generate

# 5. Compilar Nest (gera dist/)
RUN npm run build

# 6. Expor porta
EXPOSE 3000

# 7. Comando de inicialização:
#    - aplica migrations
#    - executa seed
#    - sobe a aplicação
CMD ["bash", "-c", "\
  npx prisma migrate deploy && \
  npx prisma db seed && \
  node dist/src/main.js \
"]
