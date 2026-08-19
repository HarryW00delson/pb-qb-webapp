# --- deps -------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

# --- build --------------------------------------------------------------
FROM deps AS build
COPY . .
RUN npm run build --workspace client

# --- runtime (static assets served by nginx, non-root) -------------------
# nginxinc's "unprivileged" image runs as a non-root user out of the box
# (OWASP: avoid running containers as root) and listens on 8080 instead
# of the privileged port 80.
FROM nginxinc/nginx-unprivileged:alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health && wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
