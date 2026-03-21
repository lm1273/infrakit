FROM oven/bun:1 AS base
WORKDIR /app

# Függőségek telepítése (cacheelés)
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Buildelés
FROM base AS build
COPY --from=install /app/node_modules node_modules
COPY . .
RUN bun run build

# Futtató környezet
FROM base AS release
RUN apt-get update && apt-get install -y curl ca-certificates postgresql-client && rm -rf /var/lib/apt/lists/*
COPY --from=install /app/node_modules node_modules
COPY --from=build /app/.output .output
COPY --from=build /app/package.json .
COPY setup-stack.sh /app/setup-stack.sh
RUN chmod +x /app/setup-stack.sh

# A TanStack Start server default portja
EXPOSE 3000

ENV NODE_ENV=production
CMD ./setup-stack.sh && bun run start
