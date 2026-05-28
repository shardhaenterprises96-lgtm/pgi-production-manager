# Stage 1: Build phase
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/erp/package.json ./artifacts/erp/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: Serve phase with Nginx (No more 404s!)
FROM nginx:alpine
COPY --from=builder /app/artifacts/erp/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]