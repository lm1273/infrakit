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
├── docker-compose.yaml       # Teljes stack
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

## Applikáció csatlakoztatása (pl. Next.js / Node.js)

Az InfraKit egyik legnagyobb előnye, hogy **nem igényel saját, zárt SDK csomagot**. Mivel az egész stack ipari standard protokollokra (PostgreSQL, Redis, AWS S3) épül, bármelyik modern keretrendszer beépített vagy népszerű komponenseivel natívan tud csatlakozni (zéró vendor lock-in).

A legtisztább megoldás, ha a saját alkalmazásodban (pl. a `src/lib/` mappában) létrehozol egy **egyetlen fájlból álló belső wrapper-t** (pl. `infra.ts`), és ezen keresztül éred el a backendet.

### Példa Vercel / Next.js `.env` változók:

```env
# PgBouncer-en át (alkalmazás runtime)
DATABASE_URL=postgresql://designflow:AUTO@db.tedd.hu:6432/designflow?pgbouncing=true
# Közvetlen PG (Prisma migrate-hez)
DIRECT_URL=postgresql://designflow:AUTO@dbdirect.tedd.hu:5432/designflow

# Valkey (Cache)
VALKEY_URL=redis://default:AUTO@cache.tedd.hu:6379

# Garage (S3 Storage)
S3_ENDPOINT=https://storage.tedd.hu
S3_ACCESS_KEY_ID=AUTO_GARAGE_ACCESS
S3_SECRET_ACCESS_KEY=AUTO_GARAGE_SECRET

# GlitchTip (Error tracking)
SENTRY_DSN=https://AUTO_KEY@errors.tedd.hu/1
```

### Példa belső "SDK" kliensed beállítása (`src/lib/infra.ts`):

Szükséges szabványos csomagok: `npm i @aws-sdk/client-s3 ioredis @prisma/client` (vagy drizzle stb.)

```typescript
import { S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

// 1. ADATBÁZIS (Prisma, PgBounceren keresztül)
export const db = new PrismaClient(); // A DATABASE_URL-t automatikusan az env-ből olvassa

// 2. CACHE (Valkey)
export const cache = new Redis(process.env.VALKEY_URL!);

// 3. STORAGE (Garage / S3)
export const storage = new S3Client({
  endpoint: process.env.S3_ENDPOINT!,
  region: "garage", // igazából mindegy
  forcePathStyle: true, // FONTOS S3 kompatibilis Storage-oknál!
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

// Használat a kódodban bárhol:
// import { db, cache, storage } from "@/lib/infra";
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

### Hogyan éri el a Vercel az adatbázist, ha Zero-Trust van?

A Zero-Trust izolációnk kizárólag a webes **menedzsment felületeket** (Adminer, InfraPanel stb.) rejti el a nyilvánosság elől a Tailscale mögé.

Mivel a Vercel (és más Serverless szolgáltatók) nem tudnak csatlakozni dedikált VPN-hez, a PostgreSQL (5432), a PgBouncer (6432) és a Valkey (6379) nyers TCP portjai a host gépen ("a világ felé") is nyitva maradnak. Ez iparági standard megoldás Serverless környezeteknél, melynek biztonságát a következő beépített elemek garantálják:
- A Coolify által a `.env` fájlban legenerált jelszavak 64 karakteres kriptográfiai kulcsok (brute-forceolhatatlanok).
- A Valkey konfigurálásánál eleve "amputálva" vannak a veszélyes parancsok (pl. `FLUSHALL`, `CONFIG`), így külső támadó az összes teoretikus kaput zárva találja.
