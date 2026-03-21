import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import Redis from 'ioredis';
import { Server, Key, Trash2 } from 'lucide-react';

// Valkey/Redis kliens inicializálása
const getRedisClient = () => {
  return new Redis({
    host: process.env.VALKEY_HOST || 'valkey',
    port: parseInt(process.env.VALKEY_PORT || '6379'),
    password: process.env.VALKEY_PASSWORD || undefined,
    lazyConnect: true,
  });
};

const getCacheKeys = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const redis = getRedisClient();
    await redis.connect();
    
    // Lekérünk maximum 100 kulcsot
    const keys = await redis.keys('*');
    const limitedKeys = keys.slice(0, 100);
    
    // Lekérjük a típusukat és TTL-t formázva
    const keysData = await Promise.all(
      limitedKeys.map(async (k) => {
        const type = await redis.type(k);
        const ttl = await redis.ttl(k);
        return {
          key: k,
          type,
          ttl: ttl > 0 ? `${ttl}s` : ttl === -1 ? 'Végtelen' : 'Lejárt',
        };
      })
    );
    
    await redis.quit();
    
    return { success: true, keys: keysData, total: keys.length };
  } catch (error: any) {
    console.error('Valkey Hiba:', error);
    return { success: false, error: 'Nem sikerült csatlakozni a Valkey Cache-hez.' };
  }
});

export const Route = createFileRoute('/cache')({
  loader: () => getCacheKeys(),
  component: CacheViewer,
});

function CacheViewer() {
  const data = Route.useLoaderData();

  if (!data.success) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-900 border-dashed m-6">
        <h2 className="text-lg font-bold mb-2">Hiba történt</h2>
        <p>{data.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-6 h-6 text-rose-500" />
            Valkey Cache Kezelő
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Összes kulcs a memóriában: <span className="text-slate-800 dark:text-slate-200">{data.total} db</span>
            {data.total > 100 && ' (csak az első 100 látható)'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Kulcs (Key)</th>
                <th scope="col" className="px-6 py-4 font-medium">Típus</th>
                <th scope="col" className="px-6 py-4 font-medium">Lejárat (TTL)</th>
                <th scope="col" className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.keys?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Key className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
                      <p>A cache jelenleg teljesen üres.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.keys?.map((item: any) => (
                  <tr key={item.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                      <Key className="w-4 h-4 text-slate-400" />
                      {item.key}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-xs font-mono uppercase">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {item.ttl}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100" title="Törlés">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
