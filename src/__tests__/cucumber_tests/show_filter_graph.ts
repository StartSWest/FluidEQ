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

/*
 * @jest-environment node
 */
// This is necessary so that jest and regedit works correctly in the test environment
// Specifically, functions getRandomValues and setImmediate become well defined.

import { loadFeature, defineFeature } from 'jest-cucumber';
import {
  Driver,
  startChromeDriver,
  stopChromeDriver,
} from '__tests__/utils/webdriver';
import { givenFluidEqIsRunning } from './shared_steps/fluideq';
import {
  givenBandCount,
  whenSetBandFrequency,
  whenSetFrequencyFilterType,
  whenSetFrequencyGain,
  whenSetFrequencyQuality,
} from './shared_steps/fluidEqSlider';
import {
  givenChartViewEnabledState,
  thenGraph,
} from './shared_steps/fluidEqGraph';
import {
  givenCanWriteToFluidEqConfig,
  givenEqualizerApoIsInstalled,
} from './shared_steps/equalizerApo';

const chromeDriver = startChromeDriver();

const feature = loadFeature(
  './src/__tests__/cucumber_tests/features/show_filter_graph.feature',
);
const webdriver: { driver: Driver } = { driver: undefined };

defineFeature(feature, (test) => {
  test('Apply a single peak filter', async ({ given, when, then }) => {
    givenEqualizerApoIsInstalled(given);
    givenCanWriteToFluidEqConfig(given);
    givenFluidEqIsRunning(given, webdriver, chromeDriver);
    givenBandCount(given, webdriver);
    givenChartViewEnabledState(given, webdriver);

    whenSetBandFrequency(when, webdriver);
    whenSetFrequencyGain(when, webdriver);
    whenSetFrequencyQuality(when, webdriver);
    whenSetFrequencyFilterType(when, webdriver);
    thenGraph(then, webdriver);
  }, 50000);
});

afterAll(() => {
  if (webdriver.driver) {
    webdriver.driver.deleteSession();
  }
  stopChromeDriver(chromeDriver);
});
