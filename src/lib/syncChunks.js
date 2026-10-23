// Fits text into chrome.storage.sync, whose items can't exceed 8 KB each (key and JSON value
// together) and which holds about 100 KB in all. No extension APIs here, so it can be tested.
export const SYNC_ITEM_BYTES = 8192;
export const SYNC_TOTAL_BYTES = 102400;

const encoder = new TextEncoder();
const bytesOf = (key, value) => encoder.encode(key).length + encoder.encode(JSON.stringify(value)).length;

/** Splits text into chunks that each fit one sync item under keys made by keyOf(index). */
export function splitForSync(text, keyOf, itemBytes = SYNC_ITEM_BYTES - 64) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    // Most text is ASCII; escaping and multi-byte characters only make a chunk shorter.
    let size = Math.min(text.length - start, itemBytes);
    while (size > 1 && bytesOf(keyOf(chunks.length), text.slice(start, start + size)) > itemBytes) {
      size = Math.floor(size * 0.9);
    }
    // Don't split a surrogate pair.
    const code = text.charCodeAt(start + size - 1);
    if (size > 1 && code >= 0xd800 && code <= 0xdbff) size--;
    chunks.push(text.slice(start, start + size));
    start += size;
  }
  return chunks;
}

/** The bytes the chunks take in sync storage. */
export function syncBytes(chunks, keyOf) {
  return chunks.reduce((sum, chunk, index) => sum + bytesOf(keyOf(index), chunk), 0);
}

/** A short fingerprint of the synced content, to skip sending what's already there. */
export function contentHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}
