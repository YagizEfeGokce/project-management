# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
RUN npm ci --workspace=apps/web
COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

# Production stage (nginx)
FROM nginx:alpine
RUN apk add --no-cache wget
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
