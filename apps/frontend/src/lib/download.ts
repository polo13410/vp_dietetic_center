/** How long a downloaded file's blob URL is kept, so the browser has time to read it. */
export const REVOKE_DELAY_MS = 60_000;

/**
 * Saves a file made in the browser (PDF, CSV) under the given name. The blob URL is revoked
 * a minute later, not right after the click: Safari and Firefox read the blob asynchronously
 * and drop the download if the URL is already gone.
 */
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }
}
