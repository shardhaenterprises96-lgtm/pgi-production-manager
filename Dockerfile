FROM node:20-alpine
WORKDIR /app

# Step 1: pnpm ko globally install karein
RUN npm install -g pnpm

# Step 2: Fresh installation ke liye pehle sirf configurations copy karein
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Step 3: Alpine ke liye roll-up native dependencies configure karein
RUN pnpm config set supportedArchitectures.os ["linux"] && \
    pnpm config set supportedArchitectures.cpu ["x64"] && \
    pnpm config set supportedArchitectures.libc ["musl"]

# Step 4: Pura source code copy karein
COPY . .

# Step 5: Fresh bina purane cache ke install karein
RUN pnpm install --frozen-lockfile

# Step 6: ERP app ko build karein
RUN cd artifacts/erp && pnpm build

EXPOSE 3000

# Step 7: Sahi output directory ke saath preview run karein
CMD ["sh", "-c", "cd artifacts/erp && pnpm vite preview --outDir dist --base ./ --host 0.0.0.0 --port 3000"]