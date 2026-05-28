FROM node:20

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install

RUN pnpm build

EXPOSE 3000

CMD ["sh", "-c", "cd artifacts/erp && pnpm vite preview --outDir dist --host 0.0.0.0 --port 3000"]
