import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Activity, Database, HardDrive, Server, ShieldCheck } from 'lucide-react';

import * as net from 'node:net';

function tcpPing(host: string, port: number, timeoutMs = 2000): Promise<{ isUp: boolean, latency: string }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latency = Math.round(performance.now() - start);
      socket.destroy();
      resolve({ isUp: true, latency: `${latency}ms` });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ isUp: false, latency: '-' });
    });

    socket.on('error', () => {
      resolve({ isUp: false, latency: '-' });
    });

    socket.connect(port, host);
  });
}

function formatExternalUrl(domain: string | undefined): string {
  if (!domain) return '#';
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain;
  }
  return `https://${domain}`;
}

const getServiceHealth = createServerFn({ method: 'GET' }).handler(async () => {
  // Párhuzamos TCP pingek a Docker hálózaton lévő szolgáltatásokhoz
  const [pg, bouncer, cache, s3] = await Promise.all([
    tcpPing('postgres', 5432),
    tcpPing('pgbouncer', 6432),
    tcpPing(process.env.VALKEY_HOST || 'valkey', parseInt(process.env.VALKEY_PORT || '6379')),
    tcpPing('garage', 3900)
  ]);

  return {
    postgres: { status: pg.isUp ? 'healthy' : 'down', name: 'PostgreSQL 16', latency: pg.latency, uptime: pg.isUp ? 'Online' : 'Offline' },
    pgbouncer: { status: bouncer.isUp ? 'healthy' : 'down', name: 'PgBouncer', latency: bouncer.latency, uptime: bouncer.isUp ? 'Online' : 'Offline' },
    valkey: { status: cache.isUp ? 'healthy' : 'down', name: 'Valkey Cache', latency: cache.latency, uptime: cache.isUp ? 'Online' : 'Offline' },
    garage: { status: s3.isUp ? 'healthy' : 'down', name: 'Garage S3', latency: s3.latency, uptime: s3.isUp ? 'Online' : 'Offline' },
    externalLinks: {
      glitchtip: formatExternalUrl(process.env.GLITCHTIP_DOMAIN),
      filestash: formatExternalUrl(process.env.FILESTASH_DOMAIN),
      uptimeKuma: formatExternalUrl(process.env.UPTIME_KUMA_DOMAIN),
      adminer: formatExternalUrl(process.env.ADMINER_DOMAIN),
    }
  };
});

export const Route = createFileRoute('/')({
  loader: () => getServiceHealth(),
  component: DashboardOverview,
});

function StatusBadge({ status }: { status: string }) {
  if (status === 'healthy') {
    return (
      <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
      Hiba
    </span>
  );
}

function DashboardOverview() {
  const health = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-500" />
          Rendszer Áttekintés
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Az InfraKit szolgáltatások valós idejű állapota és erőforrás-használata.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PostgreSQL Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <StatusBadge status={health.postgres.status} />
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Adatbázis</h3>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-3">{health.postgres.name}</p>
          <div className="flex gap-4 text-xs font-medium text-slate-400">
            <div>Latency: <span className="text-slate-700 dark:text-slate-300">{health.postgres.latency}</span></div>
            <div>Uptime: <span className="text-slate-700 dark:text-slate-300">{health.postgres.uptime}</span></div>
          </div>
        </div>

        {/* PgBouncer Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <StatusBadge status={health.pgbouncer.status} />
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Kapcsolat Készlet</h3>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-3">{health.pgbouncer.name}</p>
          <div className="flex gap-4 text-xs font-medium text-slate-400">
            <div>Latency: <span className="text-slate-700 dark:text-slate-300">{health.pgbouncer.latency}</span></div>
          </div>
        </div>

        {/* Valkey Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
              <Server className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <StatusBadge status={health.valkey.status} />
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Gyorsítótár</h3>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-3">{health.valkey.name}</p>
          <div className="flex gap-4 text-xs font-medium text-slate-400">
            <div>Latency: <span className="text-slate-700 dark:text-slate-300">{health.valkey.latency}</span></div>
          </div>
        </div>

        {/* Garage S3 Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
              <HardDrive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <StatusBadge status={health.garage.status} />
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Objektum Tárhely</h3>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-3">{health.garage.name}</p>
          <div className="flex gap-4 text-xs font-medium text-slate-400">
            <div>Latency: <span className="text-slate-700 dark:text-slate-300">{health.garage.latency}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">Külső Eszközök</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <a href={health.externalLinks.glitchtip} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500 hover:shadow-md transition-all group">
            <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
              <Activity className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">GlitchTip</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Hibakövetés</p>
            </div>
          </a>

          <a href={health.externalLinks.uptimeKuma} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500 hover:shadow-md transition-all group">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
              <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Uptime Kuma</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Rendszermonitoring</p>
            </div>
          </a>

          <a href={health.externalLinks.filestash} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500 hover:shadow-md transition-all group">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
              <HardDrive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Filestash</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">S3 Fájlböngésző</p>
            </div>
          </a>

          <a href={health.externalLinks.adminer} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500 hover:shadow-md transition-all group">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Adminer</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Adatbázis Kezelő</p>
            </div>
          </a>

        </div>
      </div>
    </div>
  );
}
