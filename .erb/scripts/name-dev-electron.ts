/**
 * Make the development build call itself FluidEQ in Task Manager.
 *
 * Windows names a process from the version resource compiled into its
 * executable — not from `app.setName`, not from the window title, not from
 * anything the running program can say about itself. In development the binary
 * is `node_modules/electron/dist/electron.exe`, whose FileDescription is the
 * literal string "Electron", so that is what shows up, six times over, and no
 * application code will change it.
 *
 * electron-builder stamps the packaged executable from `build.productName`, so
 * a release is already correct. This closes the gap for `pnpm start`.
 *
 * THE FILE KEEPS ITS NAME. That is not a detail — it is the whole design.
 * Electron decides `app.isPackaged` by looking at the executable's basename:
 * anything other than `electron.exe` is treated as a packaged app. Renaming the
 * binary therefore flips development into packaged mode, and everything that
 * branches on it goes wrong at once. It was tried: the preload resolved to the
 * packaged path, the AutoEq manifest was looked up under `resources/assets`
 * where it does not exist in a checkout, and `app.getVersion()` started reading
 * the executable's own four-part version resource, which is not valid semver,
 * so electron-updater threw during startup and the window never opened.
 *
 * Only the resource strings change. The basename stays `electron.exe`, so
 * `isPackaged` stays false and development behaves exactly as before — while
 * Task Manager reads FileDescription and shows FluidEQ.
 *
 * The version fields are left alone for the same reason: `app.getVersion()`
 * falls back to them, and the four-part format they use is not semver.
 */
import fs from 'fs';
import path from 'path';

/** What Task Manager should read, for every process in the tree. */
const PRODUCT_NAME = 'FluidEQ';
const COMPANY_NAME = 'FluidEQ contributors';

const distDir = path.join(__dirname, '../../node_modules/electron/dist');
const exePath = path.join(distDir, 'electron.exe');
/** Written whole, then moved over the original, so a crash cannot truncate it. */
const stagingPath = path.join(distDir, 'electron.exe.fluideq-tmp');

const run = () => {
  if (process.platform !== 'win32') {
    // The version resource is a Windows PE structure, and on other platforms
    // the process is named from the file itself, which already reads
    // "electron" and is not worth breaking `isPackaged` over.
    return;
  }
  if (!fs.existsSync(exePath)) {
    // A fresh clone before `electron` has been fetched. postinstall runs again
    // once it lands, so there is nothing to warn about.
    return;
  }

  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  const {
    NtExecutable,
    NtExecutableResource,
    Resource,
    Data,
  } = require('resedit');
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */

  const original = fs.readFileSync(exePath);
  const exe = NtExecutable.from(original);
  const res = NtExecutableResource.from(exe);

  const versionInfo = Resource.VersionInfo.fromEntries(res.entries)[0];
  const existing = versionInfo.getStringValues({ lang: 1033, codepage: 1200 });
  if (existing.FileDescription === PRODUCT_NAME) {
    // Already stamped. Rewriting the file every install would churn a 200MB
    // binary for nothing and risk failing while it is in use.
    return;
  }

  versionInfo.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      // FileDescription is the string Task Manager's Name column reads. The
      // others show in the file's Properties dialog, and leaving those saying
      // Electron beside a corrected name is worse than not bothering.
      FileDescription: PRODUCT_NAME,
      ProductName: PRODUCT_NAME,
      CompanyName: COMPANY_NAME,
      LegalCopyright: `Copyright (C) ${COMPANY_NAME}. GPL-3.0-or-later.`,
    },
  );
  versionInfo.outputToResourceEntries(res.entries);

  // The icon too, so alt-tab and the taskbar match the name.
  const iconPath = path.join(__dirname, '../../assets/icon.ico');
  if (fs.existsSync(iconPath)) {
    const icon = Data.IconFile.from(fs.readFileSync(iconPath));
    Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      1,
      1033,
      icon.icons.map((item: { data: unknown }) => item.data),
    );
  }

  res.outputResource(exe);
  fs.writeFileSync(stagingPath, Buffer.from(exe.generate()));
  try {
    fs.renameSync(stagingPath, exePath);
  } catch (renameError) {
    // Locked, which means a previous `pnpm dev` is still running. The original
    // is untouched and still correct — the name simply stays Electron until
    // the next install with nothing holding it.
    fs.rmSync(stagingPath, { force: true });
    throw renameError;
  }
  console.log('Development Electron now reports itself as FluidEQ');
};

try {
  run();
} catch (error) {
  // Never fail an install over a cosmetic rename. The app runs either way.
  console.warn(
    'Could not rename the development Electron binary:',
    (error as Error).message,
  );
  console.warn('Close any running dev instance and reinstall to pick it up.');
}
