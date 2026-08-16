/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import '@testing-library/jest-dom';
import { ReactElement } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import OpraPicker from 'renderer/OpraPicker';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  getOpraProductList,
  checkOpraUpdate,
} from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/equalizerApi', () => ({
  getOpraProductList: jest.fn(),
  loadOpraPreset: jest.fn(),
  checkOpraUpdate: jest.fn(),
  clearHeadset: jest.fn(),
  updateOpraDatabase: jest.fn(),
}));

const mockProducts = getOpraProductList as jest.Mock;
const mockCheckUpdate = checkOpraUpdate as jest.Mock;

const PRODUCT_ID = 'sennheiser::hd_600';
const CURVE_ID = 'sennheiser:hd_600::oratory1990';

const PRODUCT = {
  id: PRODUCT_ID,
  vendor: 'Sennheiser',
  name: 'HD 600',
  subtype: 'over_the_ear',
  curves: [
    {
      id: CURVE_ID,
      author: 'oratory1990',
      details: 'Harman Target',
    },
  ],
};

const settle = async () => {
  for (let level = 0; level < 8; level += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const actAndSettle = (body: () => void) =>
  act(async () => {
    body();
    await settle();
  });

describe('OpraPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProducts.mockResolvedValue([PRODUCT]);
    mockCheckUpdate.mockRejectedValue(new Error('offline'));

    Object.defineProperty(window, 'electron', {
      configurable: true,
      get: () => ({
        ipcRenderer: {
          sendMessage: () => {},
          on: () => () => {},
          once: () => {},
          removeListener: () => {},
        },
      }),
    });
  });

  const panelWith = (overrides: Partial<IFluidEqContext>): ReactElement => (
    <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, ...overrides }}>
      <OpraPicker />
    </FluidEqProviderWrapper>
  );

  const renderPanel = async (overrides: Partial<IFluidEqContext>) => {
    let result!: ReturnType<typeof render>;
    await actAndSettle(() => {
      result = render(panelWith(overrides));
    });
    return result;
  };

  it('shows the model and target pickers and no Squiglink UI', async () => {
    await renderPanel({});

    expect(
      screen.getByRole('menu', { name: 'Audio device' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menu', { name: 'Target frequency response' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Squiglink/i)).not.toBeInTheDocument();
    expect(mockProducts).toHaveBeenCalled();
  });

  /*
   * The licence, as a test.
   *
   * OPRA's data is CC BY-SA 4.0, and it asks anything that browses the database
   * to show the mark, say what the project is and link to it. That makes the
   * credit strip a requirement rather than decoration, and requirements that
   * nothing checks are the ones that get tidied away in a later refactor.
   */
  it('credits OPRA with a description and a link to the project', async () => {
    await renderPanel({});

    expect(screen.getByAltText('OPRA')).toBeInTheDocument();
    expect(
      screen.getByText(
        /community-maintained directory of product information/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'see here' })).toHaveAttribute(
      'href',
      'https://github.com/opra-project/OPRA',
    );
  });

  it('restores an applied OPRA reference into both pickers', async () => {
    await renderPanel({
      headset: PRODUCT_ID,
      headsetTarget: CURVE_ID,
      headsetSource: 'opra',
    });

    const modelMenu = screen.getByRole('menu', { name: 'Audio device' });
    const targetMenu = screen.getByRole('menu', {
      name: 'Target frequency response',
    });
    expect(within(modelMenu).getByText('HD 600')).toBeInTheDocument();
    expect(within(targetMenu).getByText('Harman Target')).toBeInTheDocument();
    // The ids are what is stored; the names are what the reader sees.
    expect(screen.getByText(/Applied: Sennheiser HD 600/)).toBeInTheDocument();
    // Scoped to the credit line: the author also names the row in the target
    // dropdown, so this text is on screen twice by design.
    expect(screen.getByText(/Distributed by OPRA by Roon/)).toHaveTextContent(
      'Preset created by oratory1990',
    );
  });

  /*
   * A preset saved before the switch names an AutoEq model that no longer
   * resolves. Its bands are stored with it and still apply, so the correction is
   * intact and audible — there is simply no row here to light up. Showing the
   * stored name beats showing "no reference applied" over a reference that is
   * very much applied.
   */
  it('still reports a reference saved under the old library', async () => {
    await renderPanel({
      headset: 'Sennheiser HD 650',
      headsetTarget: 'oratory1990 (over-ear)',
      headsetSource: 'autoeq',
    });

    expect(
      screen.getByText(/Applied: Sennheiser HD 650 · oratory1990 \(over-ear\)/),
    ).toBeInTheDocument();
  });
});
