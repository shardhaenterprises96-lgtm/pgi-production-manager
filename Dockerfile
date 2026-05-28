FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/erp/package.json ./artifacts/erp/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["sh", "-c", "cd artifacts/erp && pnpm vite preview --base ./ --host 0.0.0.0 --port 3000"]