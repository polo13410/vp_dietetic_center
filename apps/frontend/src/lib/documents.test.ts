import { describe, expect, it } from 'vitest';

import { documentProblem, previewKind } from './documents';

const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type });

describe('documents', () => {
  it('accepts the formats the API accepts', () => {
    expect(documentProblem(file('bilan.pdf', 'application/pdf'))).toBeNull();
    expect(documentProblem(file('photo.HEIC', ''))).toBeNull(); // known by its extension
    expect(documentProblem(file('menu.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBeNull();
  });

  it('explains why a file is refused', () => {
    expect(documentProblem(file('archive.zip', 'application/zip'))).toMatch(/Format non accepté.*PDF/);
    expect(documentProblem(file('page.html', 'text/html'))).toMatch(/Format non accepté/);
    expect(documentProblem(file('scan.pdf', 'application/pdf', 11 * 1024 * 1024))).toMatch(/10 Mo/);
  });

  it('previews PDFs, common images and text, not Office or HEIC files', () => {
    expect(previewKind('application/pdf')).toBe('pdf');
    expect(previewKind('image/png')).toBe('image');
    expect(previewKind('text/csv')).toBe('text');
    expect(previewKind('image/heic')).toBeNull();
    expect(previewKind('application/msword')).toBeNull();
  });
});
