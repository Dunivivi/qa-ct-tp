/** Imported question files live in IndexedDB: a full bank (~1 MB) is too close to localStorage's quota. */
export interface StoredImport {
  readonly fileName: string;
  readonly json: unknown;
  readonly importedAt: number;
}

const DB = 'ctpt-practice';
const STORE = 'imports';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'fileName' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  } finally {
    db.close();
  }
}

export const importDb = {
  all: () => run<StoredImport[]>('readonly', (s) => s.getAll() as IDBRequest<StoredImport[]>),
  put: (item: StoredImport) => run('readwrite', (s) => s.put(item)),
  remove: (fileName: string) => run('readwrite', (s) => s.delete(fileName)),
};
