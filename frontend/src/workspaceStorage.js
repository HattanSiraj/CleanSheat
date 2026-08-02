const DATABASE_NAME = "cleansheet-workspaces";
const DATABASE_VERSION = 2;
const STORE_NAME = "workspaces";
const STORAGE_VERSION_KEY = "cleansheet.storage-version";
const STORAGE_VERSION = "2";
const LEGACY_RECIPE_STORAGE_KEY = "cleansheet.cleaning-recipes";
let saveQueue = Promise.resolve();

export async function initializeCleanSheetStorage(storage = window.localStorage, indexedDB = window.indexedDB) {
  storage.removeItem(LEGACY_RECIPE_STORAGE_KEY);
  if (storage.getItem(STORAGE_VERSION_KEY) === STORAGE_VERSION) return false;
  for (const key of getCleanSheetStorageKeys(storage)) storage.removeItem(key);
  await deleteCleanSheetDatabase(indexedDB);
  storage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  return true;
}

export function getCleanSheetStorageKeys(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith("cleansheet.")) keys.push(key);
  }
  return keys;
}

export function saveWorkspace(workspaceId, snapshot) {
  const nextSave = saveQueue
    .catch(() => {})
    .then(() => saveWorkspaceNow(workspaceId, snapshot));
  saveQueue = nextSave;
  return nextSave;
}

async function saveWorkspaceNow(workspaceId, snapshot) {
  const database = await openDatabase();
  await runRequest(database, "readwrite", (store) => store.put({
    id: workspaceId,
    savedAt: new Date().toISOString(),
    snapshot,
  }));
}

export async function loadWorkspace(workspaceId) {
  const database = await openDatabase();
  const record = await runRequest(database, "readonly", (store) => store.get(workspaceId));
  return record?.snapshot ?? null;
}

export async function deleteWorkspace(workspaceId) {
  const database = await openDatabase();
  await runRequest(database, "readwrite", (store) => store.delete(workspaceId));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open browser storage."));
  });
}

function deleteCleanSheetDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not reset browser storage."));
    request.onblocked = () => reject(new Error("Close other CleanSheet tabs before resetting browser storage."));
  });
}

function runRequest(database, mode, createRequest) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browser storage request failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Browser storage transaction failed."));
  });
}
