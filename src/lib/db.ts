const DB_NAME = 'grovix_db';
const DB_VERSION = 1;

interface DownloadRecord {
  id: string;
  name: string;
  platform: string;
  url: string;
  timestamp: number;
  size?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('downloads')) {
        db.createObjectStore('downloads', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

export async function saveDownload(record: DownloadRecord): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('downloads', 'readwrite');
  const store = tx.objectStore('downloads');
  store.put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRecentDownloads(limit = 10): Promise<DownloadRecord[]> {
  const db = await openDB();
  const tx = db.transaction('downloads', 'readonly');
  const store = tx.objectStore('downloads');
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const records = request.result as DownloadRecord[];
      records.sort((a, b) => b.timestamp - a.timestamp);
      resolve(records.slice(0, limit));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearDownloads(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('downloads', 'readwrite');
  const store = tx.objectStore('downloads');
  store.clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');
  store.put({ key, value });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await openDB();
  const tx = db.transaction('settings', 'readonly');
  const store = tx.objectStore('settings');
  const request = store.get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.value as T);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
