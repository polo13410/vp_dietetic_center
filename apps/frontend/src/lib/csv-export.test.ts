import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportCsv } from './csv-export';

describe('exportCsv', () => {
  let clickMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickMock = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      setAttribute: vi.fn(),
      click: clickMock,
      remove: vi.fn(),
    } as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:test'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('triggers a download', () => {
    exportCsv(
      [{ name: 'Alice', age: 30 }],
      [{ key: 'name', label: 'Name' }, { key: 'age', label: 'Age' }],
      'test',
    );
    expect(clickMock).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('handles null/undefined values', () => {
    exportCsv(
      [{ a: null, b: undefined }],
      [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      'test',
    );
    expect(clickMock).toHaveBeenCalled();
  });

  it('sets correct filename', () => {
    const setAttributeMock = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      setAttribute: setAttributeMock,
      click: vi.fn(),
      remove: vi.fn(),
    } as any);

    exportCsv([{ x: 1 }], [{ key: 'x', label: 'X' }], 'my-report');
    expect(setAttributeMock).toHaveBeenCalledWith('download', 'my-report.csv');
  });
});
