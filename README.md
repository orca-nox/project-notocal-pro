# Notocal Pro

A self-hosted calendar, task, note, and project manager built on CalDAV. Ships as a two-container Docker stack (frontend + backend proxy) that connects to an external Radicale server.

## Architecture

```
Browser --> Caddy (:443) --> Frontend (Nginx :80)
                               |-- /assets/*         --> static files
                               |-- /<username>/*      --> Proxy --> Radicale (CalDAV)
                               |-- /.well-known/caldav --> Proxy --> Radicale
                               |-- /api/ai/*          --> Proxy --> Ollama (AI chat)
                               |-- /*                 --> index.html (SPA)
                             Proxy (Express :3001)
                               |-- CalDAV: injects Basic auth, forwards to Radicale
                               |-- AI: streams NDJSON from Ollama
                               |-- /health
```

- **Radicale** is external -- managed independently (e.g., at `/opt/radicale/`).
- **Credentials** stay server-side in the proxy. The browser never sees CalDAV or Ollama secrets.

## Prerequisites

- Docker and Docker Compose
- A running Radicale instance with htpasswd auth
- Caddy (or another reverse proxy) for TLS termination
- Ollama (optional, for AI chat)

## Deployment

### 1. Configure environment

Copy `.env.example` to `.env` in the deploy directory and fill in values:

```bash
cp .env.example /opt/notocal/.env
# Edit /opt/notocal/.env with your credentials
```

Key variables:

| Variable | Where used | Example |
|----------|-----------|---------|
| `VITE_CALDAV_USERNAME` | Build-time (baked into frontend JS) | `your_username` |
| `RADICALE_URL` | Proxy runtime | `http://radicale:5232` |
| `RADICALE_USER` | Proxy runtime | `your_username` |
| `RADICALE_PASS` | Proxy runtime | `changeme` |
| `OLLAMA_BASE_URL` | Proxy runtime | `http://localhost:11434` |
| `OLLAMA_MODEL` | Proxy runtime | `gemma4:e4b` |

`RADICALE_URL` uses the Docker container name (`radicale`) when the proxy is on the same Docker network as Radicale.

### 2. Build and start

From the project directory:

```bash
./deploy.sh
```

Or manually:

```bash
rsync -av --delete \
  --exclude='node_modules' --exclude='.git' --exclude='dist' \
  --exclude='compose.override.yaml' --exclude='.env' \
  . /opt/notocal/

cd /opt/notocal
docker compose up --build -d
```

### 3. Caddy configuration

Add to your Caddyfile:

```
notocal.example.com {
    reverse_proxy notocal-frontend:80
}
```

Caddy must be on the `notocal_notocal-net` Docker network. Add it to Caddy's `docker-compose.yml`:

```yaml
services:
  caddy:
    networks:
      - notocal_notocal-net

networks:
  notocal_notocal-net:
    external: true
```

Then reload: `cd /opt/caddy && docker compose up -d`

### 4. Verify

```bash
docker compose -f /opt/notocal/compose.yaml ps
# Both services should show "healthy"
```

## Local Development

Run two terminals:

```bash
# Terminal 1: backend proxy
cd proxy && npm run dev

# Terminal 2: frontend (Vite dev server with HMR)
npm run dev
```

The Vite dev server proxies `/api/*` and `/<username>/*` to the local proxy at `localhost:3001`. The proxy loads `.env` from the project root via dotenv.

### Docker dev (alternative)

```bash
docker compose up    # auto-applies compose.override.yaml
```

This runs Vite and the proxy in containers with bind mounts for live reload.

## Project Structure

```
.
|-- src/                  # Frontend (React + Vite)
|-- proxy/                # Backend proxy (Express)
|   |-- src/
|   |   |-- index.ts      # App entry, mounts routes
|   |   |-- routes/
|   |       |-- caldav.ts  # CalDAV reverse proxy with auth injection
|   |       |-- ai.ts     # Ollama streaming proxy
|   |       |-- health.ts # Health check endpoint
|   |-- Dockerfile
|   |-- package.json
|-- docker/
|   |-- nginx/
|       |-- default.conf.template  # Nginx config (envsubst)
|-- Dockerfile            # Frontend multi-stage build
|-- compose.yaml          # Production compose
|-- compose.override.yaml # Dev compose (HMR)
|-- deploy.sh             # Deploy to /opt/notocal
|-- .env.example
|-- docs/
    |-- plan.md           # Implementation roadmap
```
