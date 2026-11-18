/** Hands the labels to print from the pack screen to the label page. */
export type FnskuPrintItem = { sku: string; fnsku: string | null; title: string; quantity: number };

const KEY = "boxtag.fnsku-print";

export function saveFnskuPrint(items: FnskuPrintItem[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
}

export function loadFnskuPrint(): FnskuPrintItem[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as FnskuPrintItem[];
  } catch {
    return [];
  }
}
