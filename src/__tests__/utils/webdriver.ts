/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { remote } from 'webdriverio';
import path from 'path';

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

// webdriverio 9 dropped `RemoteOptions`. The replacement lives in
// `@wdio/types`, which is a transitive package and not resolvable from the
// project root under pnpm — so the type is taken from `remote` itself rather
// than adding a dependency purely to name it.
const options: Parameters<typeof remote>[0] = {
  hostname: 'localhost', // Use localhost as chrome driver server
  port: 9515, // "9515" is the port opened by chrome driver.
  capabilities: {
    browserName: 'chrome',
    'goog:chromeOptions': {
      binary: path.join(
        process.env.USERPROFILE ? process.env.USERPROFILE : '',
        'AppData/Local/Programs/FluidEQ/FluidEQ.exe',
      ),
      args: [],
    },
  },
};

export const startChromeDriver = () => {
  const cwd = path.join(__dirname, '../../../');
  const chromedriverPath = path.join(
    'node_modules/electron-chromedriver/bin',
    'chromedriver.exe',
  );
  return spawn(chromedriverPath, ['--port=9515'], {
    shell: true,
    cwd,
  });
};

export const stopChromeDriver = (
  chromeDriverProcess: ChildProcessWithoutNullStreams,
) => {
  return chromeDriverProcess.kill(9);
};

export default async function getWebDriver(
  chromeDriverProcess: ChildProcessWithoutNullStreams,
) {
  if (chromeDriverProcess === undefined) {
    throw new Error('chrome driver not started.');
  }
  return remote(options);
}

export type Driver = Awaited<ReturnType<typeof getWebDriver>>;

/**
 * The browser, once a scenario has started one.
 *
 * Optional because it genuinely is: every scenario begins with no window open
 * and the first Given launches it. The suite used to declare this as a plain
 * `Driver` and assign `undefined` to it, which is a lie the compiler cannot
 * check anything through — and it is why every step below it silently lost its
 * types.
 */
export interface IDriverSession {
  driver?: Driver;
}

/**
 * The live browser, or a failure that says what went wrong.
 *
 * A step reaching for the driver before one exists means the scenario is
 * missing its "FluidEQ is running" Given. Without this the first symptom is a
 * `TypeError` on `undefined` deep inside a selector chain, which says nothing
 * about the real mistake.
 */
export const requireDriver = (session: IDriverSession): Driver => {
  if (!session.driver) {
    throw new Error(
      'No FluidEQ window is running. A scenario must start with the step that launches it.',
    );
  }
  return session.driver;
};
