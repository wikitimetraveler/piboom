# LiveKit VM on thelanefamily.us

Self-hosted LiveKit SFU on a **DigitalOcean** Ubuntu droplet. TLS via Caddy on two subdomains. The Lane family site stays at **https://www.thelanefamily.us** — do not change `www` or apex DNS for this.

**In scope on the VM:** LiveKit server, Redis, Caddy, built-in TURN.  
**Out of scope (v1):** Node app, Python Reed/Wolfman worker, Ingress, Egress/S3.

Official reference: [LiveKit VM self-hosting](https://docs.livekit.io/transport/self-hosting/vm/).

---

## Architecture

```
Browsers (Studio / Watch Together / Wolfman)
    → wss://livekit.thelanefamily.us (Caddy → livekit-server)
    → TURN TLS turn.thelanefamily.us

Node app (local PC or Render)
    → mints JWT via LIVEKIT_* env (services/livekit.service.js)
    → HTTPS RoomService API to the same host
```

| Subdomain | Purpose |
|-----------|---------|
| `livekit.thelanefamily.us` | Signaling — `LIVEKIT_URL=wss://livekit.thelanefamily.us` |
| `turn.thelanefamily.us` | TURN/TLS (required by official generator) |

---

## 1. Create the DigitalOcean droplet

1. Sign in at [DigitalOcean](https://cloud.digitalocean.com/).
2. **Create → Droplets**
3. **Image:** Ubuntu **24.04** LTS
4. **Region:** **San Francisco 3 (SFO3)** — not San Francisco 1 (SFO1 has no Basic plans).
5. **Size:** **Basic → Regular (SSD) → Show all plans → 4 GB RAM / 2 vCPU** (~$24/mo).  
   Skip the $4–$18 rows (512 MB–2 GB); too small for LiveKit + Redis + Caddy.
6. **Authentication:** SSH key (recommended).
7. **Hostname:** `livekit` (optional).
8. **User data / cloud-init:** leave empty for now (install with `init_script.sh` after config is generated).
9. Create the droplet and copy the **public IPv4**.

### Cloud firewall

Attach a DigitalOcean Cloud Firewall to the droplet (Networking → Firewalls):

| Protocol | Port(s) | Purpose |
|----------|---------|---------|
| TCP | 80 | Let's Encrypt |
| TCP | 443 | HTTPS + TURN/TLS |
| TCP | 7881 | WebRTC TCP fallback |
| UDP | 3478 | TURN/UDP |
| UDP | 50000–60000 | WebRTC media |

Allow SSH (22) from your IP only. Skip Ingress ports (1935, 7885) until needed.

---

## 2. Generate LiveKit config (Windows PC)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) on the machine where you run this.

```powershell
mkdir livekit-thelanefamily
cd livekit-thelanefamily
docker pull livekit/generate
docker run --rm -it -v ${PWD}:/output livekit/generate
```

When prompted:

| Prompt | Value |
|--------|-------|
| Primary domain | `livekit.thelanefamily.us` |
| TURN domain | `turn.thelanefamily.us` |
| Ingress | **No** |
| Egress | **No** |

Output folder (named after the domain) contains:

- `caddy.yaml`, `docker-compose.yaml`, `livekit.yaml`, `redis.conf`
- `init_script.sh` (use this — droplet already exists)
- `cloud-init.*.yaml` (optional if creating a fresh VM with User Data)

**Save API key + secret** from `livekit.yaml` under `keys:` — server-only, never commit.

---

## 3. DNS

At your `thelanefamily.us` DNS host, add two **A** records pointing at the droplet public IP:

| Name | Type | Value |
|------|------|-------|
| `livekit` | A | `<droplet-ip>` |
| `turn` | A | `<droplet-ip>` |

Wait for propagation. Verify:

```powershell
nslookup livekit.thelanefamily.us
nslookup turn.thelanefamily.us
```

Both must return the droplet IP before install (Caddy needs this for TLS).

---

## 4. Install on the droplet

From the folder that contains `init_script.sh`:

```powershell
scp init_script.sh root@<droplet-ip>:~/
ssh root@<droplet-ip>
sudo chmod +x init_script.sh
sudo ./init_script.sh
```

The script installs Docker, Docker Compose, copies config to `/opt/livekit`, and enables systemd service `livekit-docker`.

### Verify

```bash
systemctl status livekit-docker
cd /opt/livekit && sudo docker compose logs
```

Look for Caddy: `certificate obtained successfully` for both domains.

From your PC:

```powershell
curl -I https://livekit.thelanefamily.us
```

Should respond quickly (404 or similar is fine — must not hang).

---

## 5. Wire the Node app

No code changes required. [`services/livekit.service.js`](../services/livekit.service.js) reads env and mints JWTs.

In repo-root `.env` (local PC) and Render (if used):

```env
LIVEKIT_URL=wss://livekit.thelanefamily.us
LIVEKIT_API_KEY=<from livekit.yaml keys section>
LIVEKIT_API_SECRET=<from livekit.yaml keys section>
```

Restart the Node app after updating `.env`.

### Surfaces that use LiveKit

| Surface | Room / agent |
|---------|----------------|
| Browser Studio (`/studio/desk.html`) | `studio-{reel}` · agent `StarBand` |
| Watch Together (`/watch-together/`) | `watch-together-theater` · no agent |
| Wolfman booth (`/ai/wolfman-booth.html`) | `music-wolfman-lobby` · agent `WolfmanDave` |

Voice agents need the Python worker separately (`npm run python:livekit-agent`) with the same `LIVEKIT_*` env — not on the VM in v1.

### Optional: audio egress (Archive mics)

Requires S3 env vars — see [`docs/CONFIG.md`](CONFIG.md). Self-hosted egress setup is a later step.

---

## 6. Troubleshooting

| Symptom | Check |
|---------|--------|
| Caddy no cert | DNS must point at droplet; ports 80/443 open |
| `curl` hangs | Firewall / wrong region; UDP 50000–60000 |
| Studio "LiveKit unset" | `.env` LIVEKIT_* on Node host; restart server |
| Reed never joins | Python worker not running; `LIVEKIT_AGENT_NAME=StarBand` |
| Works on Wi‑Fi, fails on corporate network | TURN — confirm `turn.thelanefamily.us` cert in logs |

**Cloud-init stuck (if used on a new VM):**

```bash
sudo cloud-init clean --logs
sudo reboot now
```

**Upgrade LiveKit:** edit `/opt/livekit/docker-compose.yaml` image tag, then:

```bash
cd /opt/livekit && sudo docker pull livekit/livekit-server && sudo docker compose up -d
```

---

## Checklist

- [ ] Droplet: Ubuntu 24.04, SFO3, 4 GB, public IPv4
- [ ] Cloud firewall: 80, 443, 7881/tcp, 3478/udp, 50000–60000/udp
- [ ] `livekit/generate` with both subdomains, no Ingress/Egress
- [ ] DNS A records for `livekit` and `turn`
- [ ] `init_script.sh` run on droplet; Caddy certs OK
- [ ] `.env` LIVEKIT_* on Node host; join test from Studio or Watch Together
