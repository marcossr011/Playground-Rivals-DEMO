FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY server ./server
COPY src ./src

EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]
