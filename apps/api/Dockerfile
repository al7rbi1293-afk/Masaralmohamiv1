FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY apps/api/package.json apps/api/package.json

RUN npm install

COPY . .

WORKDIR /app/apps/api
RUN npm run prisma:generate && npm run build

EXPOSE 3001

CMD ["sh", "-c", "npm run prisma:migrate && npm run prisma:seed && npm run start"]
