/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A level meter hidden from the graph's View menu has a way back from the
 * side column, where it stood. With the graph switched off that menu is not
 * on screen at all, and the meter was gone with nothing to press (Ivan,
 * 2026-09-26: "where are my meters").
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import SideBar from '../../../renderer/SideBar';
import {
  getGraphMeterHidden,
  toggleGraphMeter,
} from '../../../renderer/utils/graphStyle';

jest.mock('../../../renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({
    isAutoPreAmpOn: false,
    isLoading: false,
    preAmp: 0,
    setGlobalError: jest.fn(),
    setPreAmp: jest.fn(),
  }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key}(${Object.values(values).join(',')})` : key,
  }),
}));
jest.mock('../../../renderer/utils/audioEngineContext', () => ({
  useCurrentEngine: () => 'apo',
}));
jest.mock('../../../renderer/utils/enginePreamp', () => ({
  useEnginePreamp: () => undefined,
  useEnginePreampReader: () => undefined,
}));
jest.mock('../../../renderer/components/SideBarEngine', () => () => null);
jest.mock(
  '../../../renderer/components/AutoPreAmpEnablerSwitch',
  () => () => null,
);
jest.mock('../../../renderer/graph/OutputLevelMeter', () => () => (
  <div data-testid="output-meter" />
));

const SHOW = 'graph.show(graph.item.meter)';

const renderSideBar = () =>
  render(<SideBar showGraphToggle={false} onAskAboutEngine={jest.fn()} />);

describe('the side column when the level meter is hidden', () => {
  afterEach(() => {
    if (getGraphMeterHidden()) {
      act(() => toggleGraphMeter());
    }
  });

  it('draws the meter and no way back while it is shown', () => {
    // The control: the meter is there by default, with nothing to restore.
    renderSideBar();

    expect(screen.getByTestId('output-meter')).toBeTruthy();
    expect(screen.queryByRole('button', { name: SHOW })).toBeNull();
  });

  it('offers to show it again where it stood, and puts it back', () => {
    act(() => toggleGraphMeter());
    renderSideBar();

    expect(screen.queryByTestId('output-meter')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: SHOW }));

    expect(getGraphMeterHidden()).toBe(false);
    expect(screen.getByTestId('output-meter')).toBeTruthy();
    expect(screen.queryByRole('button', { name: SHOW })).toBeNull();
  });
});
