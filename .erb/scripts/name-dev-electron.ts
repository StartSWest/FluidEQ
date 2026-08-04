/**
 * Make the development build call itself FluidEQ.
 *
 * Task Manager names a process from the version resource compiled into its
 * executable — not from `app.setName`, not from the window title, not from
 * anything the running program can say about itself. In development the binary
 * is `node_modules/electron/dist/electron.exe`, whose FileDescription is the
 * literal string "Electron", so that is what Windows shows and no amount of
 * application code will change it.
 *
 * electron-builder stamps the packaged executable from `build.productName`, so
 * a release is already correct. This is what closes the gap for `pnpm start`.
 *
 * The original binary is left alone. A COPY is made beside it and stamped, and
 * `path.txt` — which is how the `electron` package tells its callers which
 * executable to launch — is pointed at the copy. Everything Electron needs sits
 * next to it in the same directory, so the copy runs exactly as the original
 * does. Overwriting the original would work too and is a worse idea: it is a
 * file the package manager owns, and a half-written exe is a broken install.
 *
 * Runs on postinstall, so a reinstall repairs it rather than silently reverting
 * to "Electron".
 */
import fs from 'fs';
import path from 'path';
import { version } from '../../release/app/package.json';

/** What Task Manager should read, for every process in the tree. */
const PRODUCT_NAME = 'FluidEQ';
const COMPANY_NAME = 'FluidEQ contributors';
const EXE_NAME = `${PRODUCT_NAME}.exe`;

const electronRoot = path.join(__dirname, '../../node_modules/electron');
const distDir = path.join(electronRoot, 'dist');
const pathFile = path.join(electronRoot, 'path.txt');
const source = path.join(distDir, 'electron.exe');
const target = path.join(distDir, EXE_NAME);

const run = () => {
  if (process.platform !== 'win32') {
    // The version resource is a Windows PE structure. Everywhere else the
    // process is named from the file on disk, which the copy already handles.
    return;
  }
  if (!fs.existsSync(source)) {
    // A fresh clone before `electron` has been fetched. postinstall runs again
    // after it lands, so there is nothing to warn about.
    return;
  }

  // resedit and its PE parser are only needed here, and only on Windows.
  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  const {
    NtExecutable,
    NtExecutableResource,
    Resource,
    Data,
  } = require('resedit');
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */

  const exe = NtExecutable.from(fs.readFileSync(source));
  const res = NtExecutableResource.from(exe);

  const versionInfo = Resource.VersionInfo.fromEntries(res.entries)[0];
  versionInfo.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      // FileDescription is the one Task Manager's Name column reads. The rest
      // are what shows in the file's Properties dialog, and leaving them
      // saying "Electron" next to a corrected name is worse than not
      // bothering.
      FileDescription: PRODUCT_NAME,
      ProductName: PRODUCT_NAME,
      InternalName: EXE_NAME,
      OriginalFilename: EXE_NAME,
      CompanyName: COMPANY_NAME,
      LegalCopyright: `Copyright (C) ${COMPANY_NAME}. GPL-3.0-or-later.`,
    },
  );
  versionInfo.setFileVersion(
    ...(version.split('.').map(Number) as [number, number, number]),
  );
  versionInfo.setProductVersion(
    ...(version.split('.').map(Number) as [number, number, number]),
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
  fs.writeFileSync(target, Buffer.from(exe.generate()));
  fs.writeFileSync(pathFile, EXE_NAME);
  console.log(`Development Electron renamed to ${EXE_NAME}`);
};

try {
  run();
} catch (error) {
  // Never fail an install over a cosmetic rename. The app runs either way;
  // it just shows up as "Electron" until this succeeds.
  console.warn(
    'Could not rename the development Electron binary:',
    (error as Error).message,
  );
}
