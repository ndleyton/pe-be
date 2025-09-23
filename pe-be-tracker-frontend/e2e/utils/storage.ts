import type { Page } from '@playwright/test';

const DB_NAME = 'pe-guest-tracker';
const STORE_NAME = 'keyval';
const GUEST_DATA_KEY = 'pe-guest-data';

const withAppOrigin = async <T>(page: Page, action: (originPage: Page) => Promise<T>): Promise<T> => {
  if (page.url() !== 'about:blank') {
    return action(page);
  }

  const tempPage = await page.context().newPage();
  try {
    await tempPage.goto('/', { waitUntil: 'domcontentloaded' });
    return await action(tempPage);
  } finally {
    await tempPage.close();
  }
};

export async function seedGuestData(page: Page, data: unknown): Promise<void> {
  await withAppOrigin(page, originPage => {
    return originPage.evaluate(({ dbName, storeName, key, payload }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        };

        request.onerror = () => {
          reject(request.error ?? new Error('Failed to open IndexedDB'));
        };

        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          // Persist in Zustand's JSON storage shape: { state }
          // Version is optional; the app's migrate() handles missing/legacy versions.
          const wrapped = { state: payload } as const;
          store.put(JSON.stringify(wrapped), key);

          tx.oncomplete = () => {
            db.close();
            resolve();
          };

          tx.onerror = () => {
            const error = tx.error ?? new Error('Failed to seed guest data');
            db.close();
            reject(error);
          };
        };
      });
    }, { dbName: DB_NAME, storeName: STORE_NAME, key: GUEST_DATA_KEY, payload: data });
  });
}

export async function clearGuestData(page: Page): Promise<void> {
  await withAppOrigin(page, originPage => {
    return originPage.evaluate(({ dbName, storeName, key }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        };

        request.onerror = () => {
          reject(request.error ?? new Error('Failed to open IndexedDB'));
        };

        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          store.delete(key);

          tx.oncomplete = () => {
            db.close();
            resolve();
          };

          tx.onerror = () => {
            const error = tx.error ?? new Error('Failed to clear guest data');
            db.close();
            reject(error);
          };
        };
      });
    }, { dbName: DB_NAME, storeName: STORE_NAME, key: GUEST_DATA_KEY });
  });
}
