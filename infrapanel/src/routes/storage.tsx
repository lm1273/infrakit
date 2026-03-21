import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { HardDrive, File as FileIcon, Trash2, Folder } from 'lucide-react';

// S3 kliens inicializálása
const getS3Client = () => {
  return new S3Client({
    region: process.env.STORAGE_REGION || 'us-east-1',
    endpoint: process.env.STORAGE_ENDPOINT || 'http://garage:3900',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || 'minioadmin',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || 'minioadmin',
    },
  });
};

const getBucketContents = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const s3 = getS3Client();
    const bucket = process.env.STORAGE_BUCKET || 'designflow';
    
    const command = new ListObjectsV2Command({
      Bucket: bucket,
    });
    
    // Catch-eljük, ha a bucket még nem létezik (első indításkor)
    try {
      const response = await s3.send(command);
      return { 
        success: true, 
        bucket, 
        files: response.Contents?.map(item => ({
          key: item.Key || '',
          size: item.Size || 0,
          lastModified: item.LastModified?.toISOString() || ''
        })) || [] 
      };
    } catch (e: any) {
      if (e.name === 'NoSuchBucket') {
        return { success: true, bucket, files: [], warning: 'A bucket még nem létezik.' }
      }
      throw e;
    }
  } catch (error: any) {
    console.error('S3 Hiba:', error);
    return { success: false, error: 'Nem sikerült csatlakozni a Garage S3-hoz.' };
  }
});

export const Route = createFileRoute('/storage')({
  loader: () => getBucketContents(),
  component: StorageManager,
});

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function StorageManager() {
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
            <HardDrive className="w-6 h-6 text-amber-500" />
            S3 Tárhely Kezelő
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Bucket: <span className="text-slate-800 dark:text-slate-200">s3://{data.bucket}</span>
          </p>
        </div>
      </div>

      {data.warning && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-900/50 text-sm">
          {data.warning}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Fájlnév</th>
                <th scope="col" className="px-6 py-4 font-medium">Méret</th>
                <th scope="col" className="px-6 py-4 font-medium">Módosítva</th>
                <th scope="col" className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.files?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Folder className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
                      <p>Nincsenek fájlok a bucketben</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.files?.map((file: any) => (
                  <tr key={file.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                      <FileIcon className="w-4 h-4 text-slate-400" />
                      {file.key}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {formatBytes(file.size)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {new Date(file.lastModified).toLocaleString('hu-HU')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* Ide jöhet a törlés funkció később */}
                      <button className="text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
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
