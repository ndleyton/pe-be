import type { StateStorage } from "zustand/middleware";

const DB_NAME = "pe-guest-tracker";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

export class IndexedDBStorage implements StateStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize database connection
   */
  private async getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.openDB();
    }
    return this.dbPromise;
  }

  /**
   * Open IndexedDB database
   */
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error("IndexedDB not supported"));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create a simple key-value store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  /**
   * Check if IndexedDB is supported
   */
  private isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "indexedDB" in window &&
      indexedDB !== null
    );
  }

  /**
   * Perform a database transaction
   */
  private async performTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(request.error?.message || "Transaction failed"));

      transaction.onerror = () =>
        reject(new Error(transaction.error?.message || "Transaction failed"));
    });
  }

  /**
   * Get item from IndexedDB
   */
  async getItem(name: string): Promise<string | null> {
    try {
      const result = await this.performTransaction("readonly", (store) =>
        store.get(name),
      );

      return result || null;
    } catch (error) {
      console.warn(`Failed to get item "${name}" from IndexedDB:`, error);
      return null;
    }
  }

  /**
   * Set item in IndexedDB
   */
  async setItem(name: string, value: string): Promise<void> {
    try {
      await this.performTransaction("readwrite", (store) =>
        store.put(value, name),
      );
    } catch (error) {
      console.error(`Failed to set item "${name}" in IndexedDB:`, error);
      throw error;
    }
  }

  /**
   * Remove item from IndexedDB
   */
  async removeItem(name: string): Promise<void> {
    try {
      await this.performTransaction("readwrite", (store) => store.delete(name));
    } catch (error) {
      console.warn(`Failed to remove item "${name}" from IndexedDB:`, error);
      // Don't throw on remove failures
    }
  }
}

/**
 * Create IndexedDB storage with localStorage fallback
 */
export function createIndexedDBStorage(): StateStorage {
  const idbStorage = new IndexedDBStorage();

  // Test IndexedDB availability on first use
  let hasTestedIDB = false;
  let useIndexedDB = false;
  let readinessPromise: Promise<boolean> | null = null;

  const ensureIDBReady = async (): Promise<boolean> => {
    if (hasTestedIDB) {
      return useIndexedDB;
    }

    if (!readinessPromise) {
      readinessPromise = (async () => {
        try {
          await idbStorage.setItem("__idb_test__", "probe");
          await idbStorage.removeItem("__idb_test__");
          useIndexedDB = true;
        } catch (error) {
          useIndexedDB = false;
          console.info(
            "IndexedDB unavailable, using localStorage fallback",
            error,
          );
        } finally {
          hasTestedIDB = true;
        }

        return useIndexedDB;
      })().finally(() => {
        readinessPromise = null;
      });
    }

    return readinessPromise;
  };

  const localStorageSafeGet = (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.warn("Failed to read from localStorage fallback:", error);
      return null;
    }
  };

  const localStorageSafeSet = (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.error("Failed to persist to localStorage fallback:", error);
      throw error;
    }
  };

  const localStorageSafeRemove = (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.warn("Failed to remove from localStorage fallback:", error);
    }
  };

  const withIndexedDBFallback = async <T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>,
  ): Promise<T> => {
    if (await ensureIDBReady()) {
      try {
        return await operation();
      } catch (error) {
        console.warn(
          "IndexedDB operation failed, falling back to localStorage:",
          error,
        );
        hasTestedIDB = false;
        useIndexedDB = false;
      }
    }

    return fallback();
  };

  return {
    async getItem(name: string): Promise<string | null> {
      return withIndexedDBFallback(
        () => idbStorage.getItem(name),
        () => localStorageSafeGet(name),
      );
    },

    async setItem(name: string, value: string): Promise<void> {
      await withIndexedDBFallback(
        () => idbStorage.setItem(name, value),
        () => {
          localStorageSafeSet(name, value);
          return Promise.resolve();
        },
      );
    },

    async removeItem(name: string): Promise<void> {
      await withIndexedDBFallback(
        () => idbStorage.removeItem(name),
        () => {
          localStorageSafeRemove(name);
          return Promise.resolve();
        },
      );
    },
  };
}
