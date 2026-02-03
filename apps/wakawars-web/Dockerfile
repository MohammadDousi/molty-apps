# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN cd packages/shared && bun run build
RUN cd apps/wakawars-web && bun run build

# Runtime stage
FROM nginx:alpine
COPY apps/wakawars-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/wakawars-web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
