import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportCsv } from './csv-export';
import { saveFile } from './download';

vi.mock('./download', () => ({ saveFile: vi.fn() }));

/** The CSV text handed to saveFile, without the BOM. */
async function savedCsv(): Promise<{ text: string; filename: string }> {
  const [blob, filename] = vi.mocked(saveFile).mock.calls.at(-1)!;
  // jsdom's Blob has no text(): read it as the browser would
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });
  return { text: text.replace(/^\ufeff/, ''), filename };
}

describe('exportCsv', () => {
  beforeEach(() => vi.mocked(saveFile).mockClear());
  afterEach(() => vi.restoreAllMocks());

  it('saves a CSV file under the given name', async () => {
    exportCsv(
      [{ name: 'Alice', age: 30 }],
      [{ key: 'name', label: 'Name' }, { key: 'age', label: 'Age' }],
      'my-report',
    );
    expect(await savedCsv()).toEqual({ text: 'Name,Age\nAlice,30', filename: 'my-report.csv' });
  });

  it('writes null/undefined values as empty cells and quotes commas', async () => {
    exportCsv(
      [{ a: null, b: undefined, c: 'x, "y"' }],
      [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }],
      'test',
    );
    expect((await savedCsv()).text).toBe('A,B,C\n,,"x, ""y"""');
  });
});
