# --- deps ---------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

# --- build ----------------------------------------------------------------
FROM deps AS build
COPY . .
# Also runs `prisma generate`, producing the Prisma Client into
# node_modules/@prisma/client — this must survive into the runtime
# image, so runtime reuses this stage's node_modules (pruned below)
# rather than a fresh install that would omit the generated client.
RUN npm run build --workspace server
# Drop devDependencies in-place so the pruned node_modules (including
# the already-generated Prisma Client) can be copied straight into the
# runtime image without reinstalling from scratch.
RUN npm prune --omit=dev --workspace server && npm cache clean --force
# npm's peerDependency handling keeps the `prisma` CLI package in place
# after prune (it's an optional peer of @prisma/client) even though it
# is a devDependency; it isn't needed at runtime (only the generated
# client + engine under .prisma/client are), so remove it explicitly.
RUN rm -rf server/node_modules/prisma

# --- runtime (production, non-root) ---------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist

# Run as a non-root user (OWASP: avoid running containers as root).
USER node

WORKDIR /app/server
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
