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

import { ChildProcessWithoutNullStreams } from 'child_process';
import { DefineStepFunction } from 'jest-cucumber';
import getWebDriver, {
  IDriverSession,
  requireDriver,
} from '__tests__/utils/webdriver';

export const givenFluidEqIsNotRunning = (given: DefineStepFunction) => {
  given('FluidEQ is not running', () => {
    // TODO find out how to check if FluidEQ is not running. find a way to close it
  });
};

export const givenFluidEqIsRunning = (
  given: DefineStepFunction,
  webdriver: IDriverSession,
  chromeDriverProcess: ChildProcessWithoutNullStreams,
) => {
  given('FluidEQ is running', async () => {
    if (webdriver.driver === undefined) {
      webdriver.driver = await getWebDriver(chromeDriverProcess);
      // Wait 10 seconds for the app to launch and load screen
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10000);
      });
    }
  });
};

export const whenFluidEqIsLaunched = (
  when: DefineStepFunction,
  webdriver: IDriverSession,
  chromeDriverProcess: ChildProcessWithoutNullStreams,
) => {
  when('FluidEQ is launched', async () => {
    webdriver.driver = await getWebDriver(chromeDriverProcess);
    // Wait 10 seconds for the app to launch and load screen
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10000);
    });
  });
};

export const givenEnabledState = (
  when: DefineStepFunction,
  webdriver: IDriverSession,
) => {
  when(
    /^FluidEQ equalizer state is (enabled|disabled)$/,
    async (state: string) => {
      const desiredState = state === 'enabled';
      const equalizerSwitch = await requireDriver(webdriver).$(
        '.side-bar label[class="switch"][for="equalizerEnabler"]',
      );

      const switchOn = await equalizerSwitch
        .$('[aria-checked="true"]')
        .isExisting();
      if ((desiredState && !switchOn) || (!desiredState && switchOn)) {
        equalizerSwitch.click();
        // wait 1000 ms for the action.
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 1000);
        });
      }
    },
  );
};

export const whenSetEnabledState = (
  when: DefineStepFunction,
  webdriver: IDriverSession,
) => {
  when(/^I toggle the equalizer state$/, async () => {
    const equalizerSwitch =
      await requireDriver(webdriver).$('.side-bar .switch');
    equalizerSwitch.click();
    // wait 1000 ms for the action.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1000);
    });
  });
};

export const givenAutoPreAmpState = (
  given: DefineStepFunction,
  webdriver: IDriverSession,
) => {
  // Auto normalize became three positions rather than two — Off, On, Smart —
  // so this drives the segmented control that replaced the switch. Each
  // position reports its own state through `aria-pressed`, which is what makes
  // "already there" answerable without reading a colour.
  given(/^auto pre-amp is (on|off|smart)$/, async (state: string) => {
    const group = await requireDriver(webdriver).$('#autoPreAmpEnabler');
    const index = { off: 0, on: 1, smart: 2 }[state] ?? 1;
    const option = await group.$$('[role="button"]')[index];
    if ((await option.getAttribute('aria-pressed')) === 'true') {
      return;
    }
    option.click();
    // wait 1000 ms for the action.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1000);
    });
  });
};
