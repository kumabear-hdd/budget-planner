/**
 * IndexedDB-backed persistence for the finance store.
 *
 * The offline spec requires transaction data in IndexedDB (not just
 * localStorage): add/edit/delete must keep working with no connection, and
 * every balance/category/savings recalculation happens on-device from this
 * data. One object store, one record — the whole persisted slice under the
 * zustand key — keeps writes atomic and conflict-free by construction (single
 * device, no sync target; see settings copy).
 *
 * localStorage copy from earlier builds is imported once so upgrading users
 * keep their history, then left in place as a harmless rollback path.
 */
import type { StateStorage } from "zustand/middleware";

const DB_NAME = "budget-planner";
const DB_VERSION = 1;
const STORE_NAME = "kv";

/** zustand persist key — same string the old localStorage entry used. */
export const STORAGE_KEY = "budget-planner-v1";

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB gagal dibuka"));
      request.onblocked = () => reject(new Error("IndexedDB terblokir tab lain"));
    });
    // A failed open must not poison every later call — reset so the next
    // write retries (e.g. private mode that warms up, or quota freed later).
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function read(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function write(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaksi IndexedDB dibatalkan"));
  });
}

/**
 * localStorage fallback used only when IndexedDB is unavailable (rare:
 * disabled storage, exotic embedded webviews). Keeps the app usable instead
 * of silently losing writes; the settings copy already warns data stays
 * on-device either way.
 */
function localStorageFallback(): StateStorage {
  return {
    getItem: (name) => {
      try {
        return window.localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value);
      } catch {
        /* quota or blocked storage — nothing else to try */
      }
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name);
      } catch {
        /* see setItem */
      }
    },
  };
}

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (!hasIndexedDb()) return localStorageFallback().getItem(name);
    try {
      const db = await openDb();
      const stored = await read(db, name);
      if (typeof stored === "string") return stored;
      // First run on IndexedDB: import the legacy localStorage entry so an
      // upgrade never looks like data loss. Written back immediately — one
      // import, then IDB is the single source of truth.
      try {
        const legacy = window.localStorage.getItem(name);
        if (legacy !== null) {
          await write(db, name, legacy);
          return legacy;
        }
      } catch {
        /* localStorage unreadable — start fresh in IDB */
      }
      return null;
    } catch {
      return localStorageFallback().getItem(name);
    }
  },
  setItem: async (name, value) => {
    if (!hasIndexedDb()) return localStorageFallback().setItem(name, value);
    try {
      const db = await openDb();
      await write(db, name, value);
    } catch {
      localStorageFallback().setItem(name, value);
    }
  },
  removeItem: async (name) => {
    if (!hasIndexedDb()) return localStorageFallback().removeItem(name);
    try {
      const db = await openDb();
      await write(db, name, undefined);
    } catch {
      localStorageFallback().removeItem(name);
    }
  },
};
