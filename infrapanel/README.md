# InfraPanel – Rendszer Műszerfal

Az InfraKit infrastruktúra stack saját menedzsment dashboardja. Valós idejű szolgáltatás monitoring, cache kezelő és S3 tárhely böngésző.

**Tech stack:** TanStack Start (React 19), Tailwind CSS v4, Vite 8, Bun

## Funkciók

- 🟢 **Rendszer Áttekintés** – PostgreSQL, PgBouncer, Valkey, Garage S3 állapota
- 🔑 **Valkey Cache Kezelő** – Cache kulcsok listázása, típus és TTL megjelenítése
- 📦 **S3 Tárhely Kezelő** – Garage bucket fájljainak böngészése
- 🔗 **Külső Eszközök** – Gyors linkek: GlitchTip, Uptime Kuma, Filestash, Adminer
- 🔐 **Biztonság** – Tailscale VPN mögé rejtett belső elérés, Cookie-alapú session autentikáció

## Fejlesztés

```sh
cd infrakit/infrapanel
bun install
bun run dev
```

Az alkalmazás a `http://localhost:3000` címen indul el.

## Build

```sh
bun run build
```

## Docker

A `Dockerfile` a production buildet szolgálja ki. Az InfraKit stack részeként a `docker-compose.yml` automatikusan buildeli és futtatja.
