# 1. Pehle package files copy karein (jaise aap pehle kar rahe the)
COPY package.json pnpm-lock.yaml ./

# 2. YAHAN PAR BADLAAV KARNA HAI: Sahi syntax ke saath architecture set karein
RUN pnpm config set supportedArchitectures.os linux && \
    pnpm config set supportedArchitectures.cpu x64 && \
    pnpm config set supportedArchitectures.libc musl

# 3. Ab fresh dependencies install karein
RUN pnpm install --frozen-lockfile

# 4. Baaki ka project code copy karein
COPY . .

# 5. Apna project build karein
RUN cd artifacts/erp && pnpm build