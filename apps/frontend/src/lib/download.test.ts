import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REVOKE_DELAY_MS, saveFile } from './download';

describe('saveFile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:test'), revokeObjectURL: vi.fn() });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clicks a link to the blob under the file name, then revokes the URL once the browser had time to read it', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:test');
      expect(this.download).toBe('facture-2026-0012.pdf');
      expect(this.isConnected).toBe(true);
    });

    saveFile(new Blob(['%PDF']), 'facture-2026-0012.pdf');

    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    // Revoking right after the click makes Safari and Firefox drop the download
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REVOKE_DELAY_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('still cleans up when the click fails, and lets the caller show its error', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => saveFile(new Blob(['x']), 'a.pdf')).toThrow('blocked');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(REVOKE_DELAY_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
