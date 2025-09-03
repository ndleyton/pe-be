import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'pe-guest-tracker';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

class IndexedDBStorage implements StateStorage {
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
        reject(new Error('IndexedDB not supported'));
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
    return typeof window !== 'undefined' && 
           'indexedDB' in window && 
           indexedDB !== null;
  }

  /**
   * Perform a database transaction
   */
  private async performTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(request.error?.message || 'Transaction failed'));
      
      transaction.onerror = () => reject(new Error(transaction.error?.message || 'Transaction failed'));
    });
  }

  /**
   * Get item from IndexedDB
   */
  async getItem(name: string): Promise<string | null> {
    try {
      const result = await this.performTransaction('readonly', (store) => 
        store.get(name)
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
      await this.performTransaction('readwrite', (store) => 
        store.put(value, name)
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
      await this.performTransaction('readwrite', (store) => 
        store.delete(name)
      );
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

  return {
    async getItem(name: string): Promise<string | null> {
      // Test IndexedDB on first access
      if (!hasTestedIDB) {
        try {
          await idbStorage.setItem('__test__', 'test');
          await idbStorage.removeItem('__test__');
          useIndexedDB = true;
        } catch {
          useIndexedDB = false;
          console.info('IndexedDB unavailable, using localStorage fallback');
        }
        hasTestedIDB = true;
      }

      if (useIndexedDB) {
        return idbStorage.getItem(name);
      } else {
        // Fallback to localStorage
        try {
          return localStorage.getItem(name);
        } catch {
          return null;
        }
      }
    },

    async setItem(name: string, value: string): Promise<void> {
      if (useIndexedDB) {
        return idbStorage.setItem(name, value);
      } else {
        // Fallback to localStorage
        try {
          localStorage.setItem(name, value);
        } catch (error) {
          console.error('Failed to save to localStorage:', error);
          throw error;
        }
      }
    },

    async removeItem(name: string): Promise<void> {
      if (useIndexedDB) {
        return idbStorage.removeItem(name);
      } else {
        // Fallback to localStorage
        try {
          localStorage.removeItem(name);
        } catch {
          // Ignore localStorage remove failures
        }
      }
    },
  };
}