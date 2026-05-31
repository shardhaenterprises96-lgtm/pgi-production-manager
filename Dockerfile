FROM node:20

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install --frozen-lockfile

# Build the frontend SPA (static assets) and the API server bundle.
ENV NODE_ENV=production
ENV BASE_PATH=/
RUN pnpm --filter @workspace/erp build && pnpm --filter @workspace/api-server build

# The API server serves both /api and the built frontend SPA in a single process.
ENV PORT=3000
ENV FRONTEND_DIST=/app/artifacts/erp/dist/public

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
