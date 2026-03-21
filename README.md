# InfraKit

Újrahasználható infrastruktúra stack Coolify-ra. Egyetlen Docker Compose → deploy → kész.

## Stack

| Service | Cél | RAM |
|---|---|---|
| **PostgreSQL** | Adatbázis (C.UTF-8 locale) | ~400 MB |
| **PgBouncer** | Connection pooler (Vercel serverless) | ~30 MB |
| **Valkey** | Cache + pub/sub (Redis fork) | ~150 MB |
| **Garage** | S3 storage (Apache 2.0) API beépített weblappal | ~256 MB |
| **GlitchTip** | Error tracking (Sentry kompatibilis) + Celery Worker | ~768 MB |
| **Adminer** | Könnyűsúlyú adatbázis kezelő UI | ~32 MB |
| **Uptime Kuma** | Health monitoring dashboard | ~64 MB |
| **Filestash** | S3 web file browser | ~64 MB |
| **InfraPanel** | Saját InfraKit belső műszerfal (TanStack Start) | ~128 MB |
| **Caddy + Tailscale** | Belső fordított proxy és VPN Gateway | ~96 MB |
| **Össz.** | Szigorú korlátokkal optimalizálva | **~2.1 GB** |

## Fájlstruktúra

```
infrakit/
├── docker-compose.yml        # Teljes stack
├── .env.example              # Konfigurációs sablon
├── setup.sh                  # Szerver előkészítő script
├── GIT_DEPLOY.md             # Részletes telepítési útmutató
├── README.md                 # Technikai dokumentáció
├── init/
│   ├── postgres/
│   │   ├── 01-extensions.sql # PG extension-ök (pgcrypto, pg_trgm, stb.)
│   │   └── 02-glitchtip-db.sql # GlitchTip külön DB
│   ├── garage/
│   │   └── garage.toml       # Garage S3 konfiguráció
│   └── caddy/
│       └── Caddyfile         # Belső Tailscale port proxy
└── infrapanel/               # Saját műszerfal (TanStack Start)
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    └── src/                  # React forráskód
```

---

## Telepítés (Coolify)

### 1. Repo push

```bash
git init
git add .
git commit -m "initial infrakit"
git remote add origin git@github.com:USERNAME/infrakit.git
git push -u origin main
```

### 2. Első Deploy Előtti Setup (Szerveren)
Mielőtt deployolsz, a Postgres miatt a mappákat és a jogosultságokat (UID 999) létre kell hozni a hoszt gépen. Lépj be SSH-n a szerveredre, válaszd ki ahova menteni akarsz, és futtasd le a setup scriptet:
```bash
cd /opt/infrakit # vagy ahova a repót klónoztad
chmod +x setup.sh
sudo ./setup.sh
```

### 3. Coolify projekt létrehozás

1. **Coolify UI** → New Project → név: `infrakit-PROJEKTNEV`
2. **Add Resource** → Docker Compose
3. **Repository URL** megadása

### 4. Environment változók (Coolify UI)

Csak ezeket kell beállítanod — **minden más default-tal működik**:

| Változó | Érték | Mikor kell |
|---|---|---|
| `PROJECT_NAME` | `designflow` | Mindig |
| `DB_NAME` | `designflow` | Mindig |
| `STORAGE_BUCKET` | `designflow-files` | Mindig |
| `VALKEY_PERSISTENT` | `true` | Mindig |
| `GLITCHTIP_DOMAIN` | `https://errors.tedd.hu` | Mindig |
| `DATA_DIR` | `/mnt/ssd2/infrakit` | Csak ha más SSD kell |

> A jelszavak (`SERVICE_PASSWORD_64_*`) **automatikusan generálódnak** Coolify magic variable-ökkel (64 karakter).

### 5. FQDN-ek és Elérések

A rendszer hibrid (publikus + privát VPN) architektúrát használ.

**Publikus szolgáltatások (HTTPS Traefik, Let's Encrypt SSL-lel):**
| Service | Port | Cím | Proxy típus |
|---|---|---|---|
| `garage` | 3900 | Publikus S3 API (`GARAGE_S3_API_DOMAIN`) | HTTPS (Traefik) |
| `glitchtip` | 8000 | Hibakövetés (`GLITCHTIP_DOMAIN`) | HTTPS (Traefik) |

**Belső TCP / Docker proxyk:**
| Service | Port | Hálózat | Proxy típus |
|---|---|---|---|
| `pgbouncer` | 6432 | DB TCP Proxy (`db.domain.hu`) | TCP proxy |
| `postgres` | 5432 | DB (migrate) (`dbdirect.domain.hu`) | TCP proxy |
| `valkey` | 6379 | Cache TCP Proxy (`cache.domain.hu`) | TCP proxy |

**Belső Zero-Trust szolgáltatások (Tailscale VPN-en keresztül):**
Ezek nincsenek az interneten! Csak a Tailscale-en bejelentkezve, a `http://infrakit-secure:<port>` címen érhetők el a saját gépedről:
| Service | Belső Port | Belső Cím |
|---|---|---|
| `infrapanel` | 3000 | `http://infrakit-secure:3000` |
| `adminer` | 8080 | `http://infrakit-secure:8080` |
| `uptime-kuma` | 3001 | `http://infrakit-secure:3001` |
| `filestash` | 8334 | `http://infrakit-secure:8334` |

> A HTTPS (Traefik) sorokra a Coolify automatikusan Let's Encrypt SSL-t kér. A belső eszközök (Adminer, Kuma, stb.) HTTP-n mennek a Tailscale végponttól végpontig titkosított csatornáján belül.

### 6. Deploy

Nyomd meg a **Deploy** gombot → kész.

---

## Next.js app csatlakoztatás (Vercel)

### Vercel env vars

```env
# PgBouncer-en át (runtime)
DATABASE_URL=postgresql://designflow:AUTO@db.tedd.hu:6432/designflow?pgbouncing=true

# Közvetlen PG (Prisma migrate — ne felejtsd el a Prisma schema-ba is!)
DIRECT_URL=postgresql://designflow:AUTO@dbdirect.tedd.hu:5432/designflow

# Valkey
VALKEY_URL=redis://default:AUTO@cache.tedd.hu:6379

# S3 Storage (Garage)
S3_ENDPOINT=https://storage.tedd.hu
S3_ACCESS_KEY_ID=AUTO_GARAGE_ACCESS
S3_SECRET_ACCESS_KEY=AUTO_GARAGE_SECRET
S3_BUCKET=designflow-files
S3_REGION=garage

# Error tracking
SENTRY_DSN=https://AUTO_KEY@errors.tedd.hu/1
```

### Prisma schema

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
}
```

### `src/lib/infra.ts` (Bun native driverek)

```typescript
import { S3Client } from "bun";

// Storage — Bun beépített S3 driver
export const storage = new S3Client({
  endpoint: process.env.S3_ENDPOINT!,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  bucket: process.env.S3_BUCKET!,
  region: "garage",
});

// Cache — Bun beépített Redis/Valkey driver (auto-detects VALKEY_URL)
export { redis as cache } from "bun";

// Helpers
export const presignUpload = (key: string, expiresIn = 3600) =>
  storage.presign(key, { method: "PUT", expiresIn });

export const presignDownload = (key: string, opts?: { expiresIn?: number; fileName?: string }) =>
  storage.presign(key, {
    expiresIn: opts?.expiresIn ?? 3600,
    contentDisposition: opts?.fileName
      ? `attachment; filename="${opts.fileName}"`
      : undefined,
  });

// Health check
export async function checkInfraHealth() {
  const [s3ok, redisOk] = await Promise.allSettled([
    storage.exists("__healthcheck__"),
    (await import("bun")).redis.ping(),
  ]);
  return {
    storage: s3ok.status === "fulfilled",
    cache: redisOk.status === "fulfilled",
    allHealthy: s3ok.status === "fulfilled" && redisOk.status === "fulfilled",
  };
}
```

---

## Post-deploy teendők

### GlitchTip beállítás (egyszer)

1. Nyisd meg `https://errors.tedd.hu`
2. Regisztrálj egy admin fiókot
3. Hozz létre egy projektet → másold ki a **DSN**-t
4. Írd be Vercel env-be: `SENTRY_DSN=...`

### Filestash beállítás (egyszer)

1. Nyisd meg `https://files.tedd.hu`
2. Admin setup → S3 backend hozzáadás:
   - Endpoint: `http://garage:3900`
   - Access Key: *Coolify-ból*
   - Secret Key: *Coolify-ból*
   - Region: `garage`
   - Bucket: `designflow-files`

### Uptime Kuma (egyszer)

1. Nyisd meg `https://monitor.tedd.hu`
2. Admin regisztráció
3. Monitor hozzáadás minden service-hez:
   - PG: TCP → `postgres:5432`
   - Valkey: TCP → `valkey:6379`
   - Garage: HTTP → `http://garage:3903/health`
   - GlitchTip: HTTP → `http://glitchtip:8000/_health/`
   - App: HTTP → `https://app.tedd.hu`

---

## Több projekt (port ütközés elkerülés)

Második projekt egyszerűen más portokkal:

```env
PROJECT_NAME=myshop
DB_NAME=myshop
STORAGE_BUCKET=myshop-files
PGBOUNCER_PORT=6433
VALKEY_PORT=6380
STORAGE_API_PORT=3910
GLITCHTIP_PORT=8001
KUMA_PORT=3002
FILESTASH_PORT=8335
```

---

## RAM összesítés

```
InfraKit stack:          ~2 GB
Coolify:                 ~1.5 GB
OS:                      ~500 MB
────────────────────────────
= ~4 GB / 8 GB → 4 GB szabad az app-nak

Második projekt: +~1.5 GB → ~5.5 GB / 8 GB → még OK
```

## Biztonsági jellemzők

- ✅ 64 karakteres auto-generált jelszavak (Coolify magic variables)
- ✅ Valkey: veszélyes parancsok letiltva (`FLUSHALL`, `CONFIG`, stb.)
- ✅ PG: C.UTF-8 locale (glibc-független, OS upgrade-biztos)
- ✅ PG: 60s graceful shutdown (`stop_grace_period`)
- ✅ Garage: admin API token védett
- ✅ Összes service: log rotation (max 30MB/service)
- ✅ **ÚJ**: Belső eszközök (Adminer, Kuma stb.) teljesen izolálva a publikus webről, beépített Tailscale VPN (Zero Trust).
- ✅ **ÚJ**: Egységes Admin belépés (ADMIN_EMAIL, ADMIN_PASSWORD) minden újonnan induló felülethez (InfraPanel, GlitchTip, stb.)
- ✅ Garage admin API nincs publikusan kitéve
