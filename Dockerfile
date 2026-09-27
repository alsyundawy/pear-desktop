# Production/CI container build for pear-desktop
FROM node:24-bullseye-slim AS builder

WORKDIR /app

# Install native compilation dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install project dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and build production bundles
COPY . .
RUN pnpm build

# Runtime runner stage
FROM node:24-bullseye-slim AS runner

WORKDIR /app

COPY --from=builder /app/out ./out
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production

CMD ["node", "out/main/index.js"]
