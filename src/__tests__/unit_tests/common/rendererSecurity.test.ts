/* FluidEQ renderer security tests. GPL-3.0-or-later. */

import fs from 'fs';
import path from 'path';
import contentSecurityPolicy from '../../../main/contentSecurityPolicy';
import wallpaperContentSecurityPolicy from '../../../main/wallpaper/wallpaperPolicy';

const readSource = (...parts: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

/** A policy's directives by name, each with its sources in order. */
const directivesOf = (policy: string) =>
  new Map(
    policy.split(';').map((entry): [string, string[]] => {
      const [name, ...sources] = entry.trim().split(/\s+/);
      return [name, sources];
    }),
  );

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

// The desktop wallpaper runs somebody else's scenes. A packaged build loads
// it over file://, where Electron applies no header, so until the build
// wrote this policy into its page it ran with none at all.
describe('wallpaper Content Security Policy', () => {
  it('lets a packaged build run only its own scripts, with no eval, and fetch nothing', () => {
    const policy = wallpaperContentSecurityPolicy(false);
    const directives = directivesOf(policy);
    expect(directives.get('default-src')).toEqual(["'none'"]);
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(directives.get('connect-src')).toEqual(["'self'"]);
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it('adds eval and the development server’s socket in development alone', () => {
    const directives = directivesOf(wallpaperContentSecurityPolicy(true));
    expect(directives.get('default-src')).toEqual(["'none'"]);
    expect(directives.get('script-src')).toEqual(["'self'", "'unsafe-eval'"]);
    expect(directives.get('connect-src')).toEqual([
      "'self'",
      'ws://localhost:*',
      'ws://127.0.0.1:*',
    ]);
  });

  it('takes the wallpaper page’s policy from the build, which writes this one in', () => {
    expect(readSource('src', 'renderer', 'wallpaper', 'index.ejs')).toMatch(
      /<meta http-equiv="Content-Security-Policy" content="<%= htmlWebpackPlugin\.options\.csp %>" \/>/,
    );
    const build = readSource(
      '.erb',
      'configs',
      'webpack.config.renderer.prod.ts',
    );
    const page = build.slice(build.indexOf("filename: 'wallpaper.html'"));
    expect(page.slice(0, page.indexOf('})'))).toContain(
      'csp: wallpaperContentSecurityPolicy(',
    );
  });
});
