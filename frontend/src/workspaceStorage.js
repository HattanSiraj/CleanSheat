const DATABASE_NAME = "cleansheet-workspaces";
const DATABASE_VERSION = 1;
const STORE_NAME = "workspaces";

export async function saveWorkspace(workspaceId, snapshot) {
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

export async function listWorkspaceIds() {
  const database = await openDatabase();
  const records = await runRequest(database, "readonly", (store) => store.getAllKeys());
  return records.map(String);
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
