const databaseName = "proteus-demo-bills-v1";
const storeName = "attachments";

function openBillDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Browser file storage is unavailable.")); return; }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local bill storage."));
  });
}

export async function saveDemoBill(transactionId: string, file: File) {
  const db = await openBillDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(file, transactionId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the file."));
      transaction.onabort = () => reject(transaction.error ?? new Error("File storage was cancelled."));
    });
  } finally { db.close(); }
  return { name: file.name, type: file.type, size: file.size, uploadedAt: new Date().toISOString() };
}

export async function getDemoBill(transactionId: string) {
  const db = await openBillDatabase();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db.transaction(storeName, "readonly").objectStore(storeName).get(transactionId);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error ?? new Error("Could not read the local file."));
    });
  } finally { db.close(); }
}
