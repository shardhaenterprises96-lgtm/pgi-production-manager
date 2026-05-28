FROM node:20-alpine
WORKDIR /app

# install pnpm globally
RUN npm install -g pnpm

# core workspace configuration files copy karein
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# sabhi packages/artifacts ke package.json copy karein taaki dependencies structure sahi bane
COPY artifacts/erp/package.json ./artifacts/erp/
COPY mockup-sandbox/package.json ./mockup-sandbox/

# sabhi packages ke liye dependencies globally and locally install karein
RUN pnpm install

# baki bacha saara code repository se container me copy karein
COPY . .

# sirf main ERP software ko build karein bina pure workspace ko distrub kiye
RUN cd artifacts/erp && pnpm build

EXPOSE 3000

# vite preview chalayein root domain base set karke
CMD ["sh", "-c", "cd artifacts/erp && pnpm vite preview --base ./ --host 0.0.0.0 --port 3000"]