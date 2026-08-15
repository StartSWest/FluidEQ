/* FluidEQ renderer security tests. GPL-3.0-or-later. */

import fs from 'fs';
import path from 'path';

describe('renderer Content Security Policy', () => {
  it('allows WebAssembly compilation without enabling JavaScript eval', () => {
    const template = fs.readFileSync(
      path.join(process.cwd(), 'src', 'renderer', 'index.ejs'),
      'utf8',
    );
    const content = template.match(/content="([^"]+)"/)?.[1] ?? '';
    const scriptSource = content
      .split(';')
      .find((directive) => directive.trim().startsWith('script-src'));
    const directives = scriptSource?.trim().split(/\s+/) ?? [];

    expect(directives).toContain("'wasm-unsafe-eval'");
    expect(directives).not.toContain("'unsafe-eval'");
    expect(content).toContain("worker-src 'self' blob:");
  });
});
