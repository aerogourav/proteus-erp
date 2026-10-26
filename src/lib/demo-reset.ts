import { CONFIG_STORAGE_KEY } from "@/lib/configuration-model";
import { JOURNEY_STORAGE_KEY } from "@/lib/journey-data";

/** Every browser-local key the demo writes (storage key names are internal and kept for compatibility). */
const localKeys = [
  CONFIG_STORAGE_KEY,
  "proteus-demo-opportunities-v1",
  "proteus-demo-business-records-v1",
  "proteus-demo-community-v1",
  JOURNEY_STORAGE_KEY,
];
const sessionKeys = ["proteus-demo-guide-dismissed"];
const billDatabase = "proteus-demo-bills-v1";

/** Removes all demo data from this browser and reloads the demo overview with the sample scenario. */
export function resetAllDemoData() {
  try { localKeys.forEach((key) => window.localStorage.removeItem(key)); } catch { /* Storage may be blocked. */ }
  try { sessionKeys.forEach((key) => window.sessionStorage.removeItem(key)); } catch { /* Storage may be blocked. */ }
  try { if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase(billDatabase); } catch { /* IndexedDB may be blocked. */ }
  window.location.assign("/demo");
}
