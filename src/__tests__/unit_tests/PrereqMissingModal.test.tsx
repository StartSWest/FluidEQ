/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TAudioEngine } from 'common/audioEngine';
import en from 'common/i18n/en';
import PrereqMissingModal from 'renderer/PrereqMissingModal';
import { startEqualizerApoInstall } from 'renderer/utils/apoInstall';

jest.mock('renderer/utils/apoInstall', () => ({
  startEqualizerApoInstall: jest.fn(async () => 'started'),
}));

const renderModal = (
  engine: TAudioEngine,
  onInstallFluid = jest.fn(async () => {}),
) => {
  render(
    <PrereqMissingModal
      engine={engine}
      isLoading={false}
      errorMsg="Something is missing."
      actionMsg="Please put it back."
      onRetry={jest.fn()}
      onInstallFluid={onInstallFluid}
    />,
  );
  return onInstallFluid;
};

describe('PrereqMissingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers the bundled Equalizer APO installer under APO', () => {
    renderModal('apo');

    expect(screen.getByRole('heading')).toHaveTextContent(
      en['prereq.title.apo'],
    );
    expect(screen.getByText(/Something is missing/)).toBeInTheDocument();
    expect(screen.getByText(/bundled unchanged/)).toBeInTheDocument();

    const install = screen.getByRole('button', {
      name: en['prereq.install.apo'],
    });
    expect(install).toHaveClass('button');
    expect(install).not.toHaveClass('subtle');
    fireEvent.click(install);
    expect(startEqualizerApoInstall).toHaveBeenCalledTimes(1);
  });

  it('installs the engine rather than APO under the FluidEQ Engine', async () => {
    const onInstallFluid = renderModal('fluid');

    expect(screen.getByRole('heading')).toHaveTextContent(
      en['prereq.title.fluid'],
    );
    // Equalizer APO has nothing to do with this failure, so its credit line
    // and its installer must not appear anywhere near it.
    expect(screen.queryByText(/bundled unchanged/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en['prereq.install.apo'] }),
    ).not.toBeInTheDocument();

    const install = screen.getByRole('button', {
      name: en['prereq.install.fluid'],
    });
    expect(install).toHaveClass('button');
    expect(install).not.toHaveClass('subtle');
    fireEvent.click(install);

    await waitFor(() => expect(onInstallFluid).toHaveBeenCalledTimes(1));
    expect(startEqualizerApoInstall).not.toHaveBeenCalled();
  });

  it('keeps the loud style for the repair and the quiet one for the rest', () => {
    renderModal('fluid');

    expect(
      screen.getByRole('button', { name: en['prereq.retry'] }),
    ).toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: en['prereq.dismiss'] }),
    ).toHaveClass('subtle');
  });

  it('goes away when dismissed', async () => {
    renderModal('apo');

    fireEvent.click(screen.getByRole('button', { name: en['prereq.dismiss'] }));

    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });
});
