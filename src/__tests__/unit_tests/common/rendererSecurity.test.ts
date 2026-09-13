/* FluidEQ renderer security tests. GPL-3.0-or-later. */

import fs from 'fs';
import path from 'path';
import contentSecurityPolicy from '../../../main/contentSecurityPolicy';

describe('renderer Content Security Policy', () => {
  // The meta tag is the only policy a packaged window loaded over file://
  // gets, so it must be the one contentSecurityPolicy() builds, written in by
  // the renderer's webpack configs — not a second, hand-written policy.
  it('takes the window policy from the build, not from a string of its own', () => {
    const template = fs.readFileSync(
      path.join(process.cwd(), 'src', 'renderer', 'index.ejs'),
      'utf8',
    );
    expect(template).toContain('htmlWebpackPlugin.options.csp');
  });

  it('allows WebAssembly compilation without enabling JavaScript eval', () => {
    const content = contentSecurityPolicy(false);
    const scriptSource = content
      .split(';')
      .find((directive) => directive.trim().startsWith('script-src'));
    const directives = scriptSource?.trim().split(/\s+/) ?? [];

    expect(directives).toContain("'wasm-unsafe-eval'");
    expect(directives).not.toContain("'unsafe-eval'");
    expect(content).toContain("worker-src 'self' blob:");
  });
});
