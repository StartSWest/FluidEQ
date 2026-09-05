/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

import electronPackage from 'electron/package.json';
import driverPackage from 'electron-chromedriver/package.json';

it('keeps the GUI test driver on the installed Electron release', () => {
  // A driver from Electron 42 supports Chromium 148 and cannot automate the
  // Chromium 150 window shipped by Electron 43, even though both install cleanly.
  expect(driverPackage.version).toBe(electronPackage.version);
});
