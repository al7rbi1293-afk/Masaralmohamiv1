FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN npm install

COPY . .

WORKDIR /app/apps/worker
RUN npm run prisma:generate && npm run build

CMD ["npm", "run", "start"]
