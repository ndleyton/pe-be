import { beforeEach, describe, expect, it, vi } from "vitest";

import { createIndexedDBStorage, IndexedDBStorage } from "./indexedDBStorage";

const localStorageProto = Object.getPrototypeOf(window.localStorage);

describe("createIndexedDBStorage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("uses IndexedDB implementation when available", async () => {
    const store = new Map<string, string>();

    const idbSetSpy = vi
      .spyOn(IndexedDBStorage.prototype, "setItem")
      .mockImplementation(async (key, storedValue) => {
        store.set(key, storedValue);
      });

    const idbGetSpy = vi
      .spyOn(IndexedDBStorage.prototype, "getItem")
      .mockImplementation(async (key) => store.get(key) ?? null);

    const idbRemoveSpy = vi
      .spyOn(IndexedDBStorage.prototype, "removeItem")
      .mockImplementation(async (key) => {
        store.delete(key);
      });

    const localSetSpy = vi.spyOn(localStorageProto, "setItem");
    const localGetSpy = vi.spyOn(localStorageProto, "getItem");
    const localRemoveSpy = vi.spyOn(localStorageProto, "removeItem");

    const storage = createIndexedDBStorage();

    await storage.setItem("foo", "bar");
    expect(idbSetSpy).toHaveBeenCalledWith("foo", "bar");
    expect(localSetSpy).not.toHaveBeenCalled();

    const value = await storage.getItem("foo");
    expect(value).toBe("bar");
    expect(idbGetSpy).toHaveBeenCalledWith("foo");
    expect(localGetSpy).not.toHaveBeenCalled();

    await storage.removeItem("foo");
    expect(idbRemoveSpy).toHaveBeenCalledWith("foo");
    expect(localRemoveSpy).not.toHaveBeenCalled();

    expect(store.has("foo")).toBe(false);
  });

  it("falls back to localStorage when IndexedDB is unavailable", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    vi.spyOn(IndexedDBStorage.prototype, "setItem").mockImplementation(
      async () => {
        throw new Error("IndexedDB unavailable");
      },
    );
    vi.spyOn(IndexedDBStorage.prototype, "removeItem").mockImplementation(
      async () => {
        throw new Error("IndexedDB unavailable");
      },
    );

    const localSetSpy = vi.spyOn(localStorageProto, "setItem");
    const localGetSpy = vi.spyOn(localStorageProto, "getItem");
    const localRemoveSpy = vi.spyOn(localStorageProto, "removeItem");

    const storage = createIndexedDBStorage();

    await storage.setItem("foo", "bar");
    expect(localSetSpy).toHaveBeenCalledWith("foo", "bar");

    const value = await storage.getItem("foo");
    expect(value).toBe("bar");
    expect(localGetSpy).toHaveBeenCalledWith("foo");

    await storage.removeItem("foo");
    expect(localRemoveSpy).toHaveBeenCalledWith("foo");
  });

  it("falls back to localStorage when IndexedDB operations fail after readiness", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const probeSuccess = vi
      .spyOn(IndexedDBStorage.prototype, "setItem")
      .mockImplementation(async (key, _value) => {
        if (key === "__idb_test__") {
          return;
        }
        throw new Error("write failure");
      });

    vi.spyOn(IndexedDBStorage.prototype, "removeItem").mockImplementation(
      async (key) => {
        if (key === "__idb_test__") {
          return;
        }
        throw new Error("remove failure");
      },
    );

    vi.spyOn(IndexedDBStorage.prototype, "getItem").mockImplementation(
      async () => {
        throw new Error("read failure");
      },
    );

    const localSetSpy = vi.spyOn(localStorageProto, "setItem");
    const localGetSpy = vi.spyOn(localStorageProto, "getItem");
    const localRemoveSpy = vi.spyOn(localStorageProto, "removeItem");

    const storage = createIndexedDBStorage();

    await storage.setItem("foo", "bar");
    expect(probeSuccess).toHaveBeenCalledWith("__idb_test__", "probe");
    expect(localSetSpy).toHaveBeenCalledWith("foo", "bar");

    const value = await storage.getItem("foo");
    expect(value).toBe("bar");
    expect(localGetSpy).toHaveBeenCalledWith("foo");

    await storage.removeItem("foo");
    expect(localRemoveSpy).toHaveBeenCalledWith("foo");
  });
});
