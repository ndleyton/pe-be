import type { Page } from '@playwright/test';

const DB_NAME = 'pe-guest-tracker';
const STORE_NAME = 'keyval';
const GUEST_DATA_KEY = 'pe-guest-data';

const runInPage = <T>(page: Page, callback: (args: T) => unknown, args: T) => {
  return page.evaluate(callback, args);
};

export async function seedGuestData(page: Page, data: unknown): Promise<void> {
  await page.goto('about:blank');
  await runInPage(page, ({ dbName, storeName, key, payload }) => {
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
        store.put(JSON.stringify(payload), key);

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
}

export async function clearGuestData(page: Page): Promise<void> {
  await runInPage(page, ({ dbName, storeName, key }) => {
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
}
