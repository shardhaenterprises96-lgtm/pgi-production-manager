FROM node:20-alpine
WORKDIR /app

# install pnpm globally
RUN npm install -g pnpm

# Pehle saari main workspace and configuration files copy karein
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Saara source code copy karein (isme mockup-sandbox aur baki sab automatically aa jayega)
COPY . .

# Dependencies install karein
RUN pnpm install

# Sirf main ERP software ko build karein
RUN cd artifacts/erp && pnpm build

EXPOSE 3000

# App ko root base URL par run karein
CMD ["sh", "-c", "cd artifacts/erp && pnpm vite preview --base ./ --host 0.0.0.0 --port 3000"]