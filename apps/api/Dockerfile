# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY prisma ./prisma/
RUN npm ci --workspace=apps/api
COPY apps/api ./apps/api
RUN npm run prisma:generate

# Production stage
FROM node:20-alpine
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

# Run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
RUN mkdir -p /app/apps/api/src/data && chown -R nodejs:nodejs /app/apps/api/src/data
USER nodejs

EXPOSE 3001
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
CMD ["./entrypoint.sh"]
