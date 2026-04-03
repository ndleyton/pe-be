import { afterEach, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const hasStorageShape = (storage: unknown): storage is Storage =>
  !!storage &&
  typeof storage === "object" &&
  typeof (storage as Storage).getItem === "function" &&
  typeof (storage as Storage).setItem === "function" &&
  typeof (storage as Storage).removeItem === "function" &&
  typeof (storage as Storage).clear === "function" &&
  typeof (storage as Storage).key === "function";

const ensureStorage = (name: "localStorage" | "sessionStorage") => {
  const current = globalThis[name];
  if (hasStorageShape(current)) {
    return current;
  }

  const replacement = new MemoryStorage();
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: replacement,
  });

  return replacement;
};

const normalizeWebStorage = () => {
  ensureStorage("localStorage");
  ensureStorage("sessionStorage");
};

normalizeWebStorage();

beforeEach(() => {
  normalizeWebStorage();
});

afterEach(() => {
  normalizeWebStorage();
  vi.restoreAllMocks();
});

// Suppress console errors from JSDOM network issues and React act warnings
const originalError = console.error;
console.error = (...args: any[]) => {
  // Suppress specific network-related errors and React act warnings
  if (
    args[0]?.toString().includes("AggregateError") ||
    args[0]?.toString().includes("xhr-utils.js") ||
    args[0]?.toString().includes("XMLHttpRequest-impl.js") ||
    args[0]?.toString().includes("was not wrapped in act") ||
    args[0]
      ?.toString()
      .includes("When testing, code that causes React state updates")
  ) {
    return;
  }
  originalError(...args);
};
