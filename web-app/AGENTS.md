<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Architecture overview
Jetwise is a Next.js 16 fleet management PWA for Airlines Manager 4. The single deployable is in `web-app/`. A Python data pipeline at the repo root is optional (CI-only).

### Local database setup
The app uses `@vercel/postgres` (backed by `@neondatabase/serverless`) which communicates via HTTP/WebSocket, **not** standard PostgreSQL protocol. Local dev requires:
1. **PostgreSQL** running on port 5432 (user must have superuser privileges for the neon proxy to authenticate).
2. **Docker** running the `ghcr.io/timowilhelm/local-neon-http-proxy:main` container with `PG_CONNECTION_STRING` pointing to the local Postgres. This proxy listens on port 4444 (HTTP) and 4445 (WebSocket).
3. **`/etc/hosts`** must contain `127.0.0.1 db.localtest.me` for the proxy's TLS certificate to work.
4. **`instrumentation.ts`** patches `neonConfig` at startup to redirect neon HTTP/WS calls from `localhost` to `db.localtest.me:4444`.
5. **`next.config.ts`** uses `serverExternalPackages: ["@neondatabase/serverless"]` so Turbopack doesn't bundle the neon driver — this is required for the instrumentation patch to share the same module instance across route handlers.

### Environment variables (`web-app/.env.local`)
- `POSTGRES_URL` — must use `localhost` as hostname (not `db.localtest.me`) so `@vercel/postgres` passes its localhost validation.
- `JETWISE_PIN` — default `3363`.
- `JETWISE_AUTH_SECRET` — any non-empty string for dev.

### Key commands (all run from `web-app/`)
- **Dev server:** `npm run dev` (port 3000)
- **Lint:** `npm run lint`
- **Build:** `npm run build`

### Starting services (after update script)
```bash
pg_ctlcluster 16 main start
dockerd &>/var/log/dockerd.log &
sleep 5
docker start neon-proxy 2>/dev/null || docker run -d --name neon-proxy --network host \
  -e PG_CONNECTION_STRING="postgresql://jetwise:jetwise123@localhost:5432/jetwise" \
  ghcr.io/timowilhelm/local-neon-http-proxy:main
```

### Gotchas
- The `@vercel/postgres` `sql` template tag uses the neon HTTP driver internally — it will **not** work with a plain PostgreSQL connection string alone.
- The `serverExternalPackages` setting in `next.config.ts` is critical; removing it breaks all database calls because Turbopack creates separate module instances.
- The neon proxy requires the Postgres user to have superuser privileges (it reads `pg_authid` for authentication).
- `db/airport_lookup.sql` has a quoting bug (apostrophe in O'Hare) — this is a pre-existing issue and safe to ignore.
