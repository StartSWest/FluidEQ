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

const OK = { ok: true, declined: false, endpoints: [] };

const renderModal = (
  engine: TAudioEngine | null,
  onInstallFluid = jest.fn(async () => OK),
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

  // Finding: the handler used to drop `result.declined`/`result.error` and
  // return `void`, so a Windows prompt that was declined — or a setup that
  // failed outright — cleared the "Starting…" label and left the banner
  // looking like the button had done nothing at all.
  it('shows the declined message when the Windows prompt is declined', async () => {
    const onInstallFluid = renderModal(
      'fluid',
      jest.fn(async () => ({ ok: false, declined: true, endpoints: [] })),
    );

    fireEvent.click(
      screen.getByRole('button', { name: en['prereq.install.fluid'] }),
    );

    expect(await screen.findByText(en['engine.declined'])).toBeInTheDocument();
    await waitFor(() => expect(onInstallFluid).toHaveBeenCalledTimes(1));
  });

  it('shows the failed message when the engine install fails outright', async () => {
    renderModal(
      'fluid',
      jest.fn(async () => ({
        ok: false,
        declined: false,
        error: 'the helper did not run',
        endpoints: [],
      })),
    );

    fireEvent.click(
      screen.getByRole('button', { name: en['prereq.install.fluid'] }),
    );

    expect(await screen.findByText(en['engine.failed'])).toBeInTheDocument();
  });

  // While the engine status has not answered yet, neither variant's copy is
  // safe: it could name the wrong engine's repair. The generic failure text
  // stays up; the title, the credit line and the install button wait.
  it('renders no engine-specific content while the engine is not known yet', () => {
    renderModal(null);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText(/Something is missing/)).toBeInTheDocument();
    expect(screen.queryByText(/bundled unchanged/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en['prereq.install.apo'] }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en['prereq.install.fluid'] }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: en['prereq.retry'] }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: en['prereq.dismiss'] }),
    ).toBeInTheDocument();
  });
});
