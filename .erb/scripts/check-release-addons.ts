import fs from 'fs';
import path from 'path';

/**
 * Refuses a release whose built code contains an add-on (`addons.ts`).
 *
 * The release configs never load one, so this should never find anything;
 * it exists because "should never" is not a thing to ship a public build on.
 * An add-on announces itself when it registers (`registerMainAddon` and
 * `registerRendererAddon` take a name starting `fluideq-addon:`), and talks
 * to its main side over channels named `addon:<name>-…`; the app's own code
 * contains neither as a string. Run by `pnpm package` after the build and
 * before electron-builder, on every branch.
 */

const MARKERS: readonly RegExp[] = [
  /fluideq-addon:/,
  // A channel named in a string. The preload's own guard is a regular
  // expression (`/^addon:[a-z0-9]…/`), which no quote precedes.
  /['"`]addon:[a-z0-9]/,
];

const DIST = path.resolve(__dirname, '../../release/app/dist');

const filesUnder = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return filesUnder(full);
        return /\.(js|cjs|mjs|html|json)$/.test(entry.name) ? [full] : [];
      })
    : [];

/** Every built file holding add-on code, with what gave it away. */
export const findAddonCode = (dir: string): string[] =>
  filesUnder(dir).flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const marker = MARKERS.find((pattern) => pattern.test(text));
    return marker ? [`${path.relative(dir, file)} (${marker.source})`] : [];
  });

if (require.main === module) {
  if (
    !fs.existsSync(path.join(DIST, 'main')) ||
    !fs.existsSync(path.join(DIST, 'renderer'))
  ) {
    console.error(`No built app in ${DIST}: run the build before this check.`);
    process.exit(1);
  }
  const found = findAddonCode(DIST);
  if (found.length > 0) {
    console.error(
      `This build contains add-on code and must not be released:\n  ${found.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log('Release check: no add-on code in the build.');
}
