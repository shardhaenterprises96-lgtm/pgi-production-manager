FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install --frozen-lockfile

RUN cd artifacts/erp && pnpm build

EXPOSE 3000

CMD ["sh", "-c", "cd artifacts/erp && pnpm vite preview --host 0.0.0.0 --port 3000"]