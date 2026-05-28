FROM node:20

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install --frozen-lockfile

RUN cd artifacts/erp && pnpm build

WORKDIR /app/artifacts/erp

EXPOSE 3000

CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "3000"]