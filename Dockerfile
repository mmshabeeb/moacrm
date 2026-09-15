# Production Dockerfile for MOA AI Designer & CRM
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and static assets
COPY src/ ./src/
COPY public/ ./public/
COPY tests/ ./tests/
COPY prisma/ ./prisma/
COPY extensions/ ./extensions/
COPY shopify.app.toml ./

# Build TypeScript to JavaScript
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --only=production

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/rules ./dist/src/rules

EXPOSE 3001

CMD ["npm", "start"]
