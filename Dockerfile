FROM node:20-alpine
WORKDIR /app

# 1. pnpm ko globally install karein
RUN npm install -g pnpm

# 2. Saari files ko container mein ek sath copy karein
COPY . .

# 3. Alpine architecture ke liye configurations automate karein
RUN pnpm config set supportedArchitectures.os ["linux"] && \
    pnpm config set supportedArchitectures.cpu ["x64"] && \
    pnpm config set supportedArchitectures.libc ["musl"]

# 4. Fresh clean installation bina purane cache ke
RUN pnpm install --frozen-lockfile

# 5. ERP software build pipeline run karein
RUN cd artifacts/erp && pnpm build

EXPOSE 3000

# 6. Sahi static folder directory path target karein
CMD ["sh", "-c", "cd artifacts/erp && pnpm vite preview --outDir dist --base ./ --host 0.0.0.0 --port 3000"]