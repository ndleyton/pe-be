import { useState, useEffect, useCallback } from 'react';
import { createIndexedDBStorage } from '@/stores/indexedDBStorage';

const storage = typeof window !== 'undefined' ? createIndexedDBStorage() : null;

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    if (!storage) return;

    let isActive = true;

    const hydrate = async () => {
      try {
        const item = await storage.getItem(key);
        if (!isActive) return;

        if (item !== null) {
          setStoredValue(JSON.parse(item));
        } else {
          setStoredValue(initialValue);
        }
      } catch (error) {
        console.error(`Error reading persistent key "${key}":`, error);
        if (isActive) {
          setStoredValue(initialValue);
        }
      }
    };

    hydrate();

    return () => {
      isActive = false;
    };
  }, [key, initialValue]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;

        if (storage) {
          (storage as any)
            .setItem(key, JSON.stringify(valueToStore))
            .catch((error: any) => {
              console.error(`Error setting persistent key "${key}":`, error);
            });
        }

        return valueToStore;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
