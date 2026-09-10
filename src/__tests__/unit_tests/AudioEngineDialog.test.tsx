/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IAudioEngineStatus } from 'common/audioEngine';
import en from 'common/i18n/en';
import AudioEngineDialog from 'renderer/components/AudioEngineDialog';

const status = (
  overrides: Partial<IAudioEngineStatus> = {},
): IAudioEngineStatus => ({
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
  ...overrides,
});

const applyButton = () =>
  screen.getByRole('button', { name: en['engine.apply'] });

describe('AudioEngineDialog', () => {
  it('offers exactly the two engines', () => {
    render(<AudioEngineDialog status={status()} onApply={jest.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveTextContent(en['engine.fluid.name']);
    expect(radios[1]).toHaveTextContent(en['engine.apo.name']);
    expect(radios[0]).toHaveTextContent(en['engine.fluid.l3']);
    expect(radios[1]).toHaveTextContent(en['engine.apo.l3']);
  });

  it('will not apply the engine that is already running', () => {
    render(<AudioEngineDialog status={status()} onApply={jest.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: /Equalizer APO/ }));
    expect(applyButton()).toBeDisabled();

    fireEvent.click(screen.getAllByRole('radio')[0]);
    expect(applyButton()).toBeEnabled();
  });

  it('applies the engine that was picked', async () => {
    const onApply = jest.fn().mockResolvedValue(undefined);
    render(<AudioEngineDialog status={status()} onApply={onApply} />);

    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(applyButton());

    await waitFor(() => expect(onApply).toHaveBeenCalledWith('fluid'));
  });

  it('moves the selection with the arrow keys', () => {
    render(<AudioEngineDialog status={status()} onApply={jest.fn()} />);

    const [fluid, apo] = screen.getAllByRole('radio');
    fireEvent.keyDown(apo, { key: 'ArrowUp' });
    expect(fluid).toHaveAttribute('aria-checked', 'true');
    expect(apo).toHaveAttribute('aria-checked', 'false');

    fireEvent.keyDown(fluid, { key: 'ArrowDown' });
    expect(apo).toHaveAttribute('aria-checked', 'true');
  });

  it('escapes only when there is something to escape to', () => {
    const onCancel = jest.fn();
    const { unmount } = render(
      <AudioEngineDialog
        status={status()}
        onApply={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    // The blocking first run: there is no chosen engine to fall back to, so
    // the dialog must not be dismissable at all.
    render(
      <AudioEngineDialog
        status={status({ engine: null })}
        onApply={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: en['engine.cancel'] }),
    ).not.toBeInTheDocument();
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('refuses the engine Windows is too old for, and says why', () => {
    render(
      <AudioEngineDialog
        status={status({ fluidSupported: false })}
        onApply={jest.fn()}
      />,
    );

    const [fluid] = screen.getAllByRole('radio');
    expect(fluid).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(en['engine.unsupported'])).toBeInTheDocument();

    fireEvent.click(fluid);
    expect(fluid).toHaveAttribute('aria-checked', 'false');
  });

  it('carries the Equalizer APO repairs only while APO is the engine', () => {
    const onApoAction = jest.fn();
    const { unmount } = render(
      <AudioEngineDialog
        status={status()}
        onApply={jest.fn()}
        onApoAction={onApoAction}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: en['engine.apo.reconfigure'] }),
    );
    expect(onApoAction).toHaveBeenCalledWith('reconfigure');
    expect(
      screen.getByRole('button', { name: en['engine.apo.settings'] }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: en['engine.apo.reinstall'] }),
    ).toBeInTheDocument();
    unmount();

    render(
      <AudioEngineDialog
        status={status({ engine: 'fluid' })}
        onApply={jest.fn()}
        onApoAction={onApoAction}
      />,
    );
    expect(
      screen.queryByRole('button', { name: en['engine.apo.reconfigure'] }),
    ).not.toBeInTheDocument();
  });

  it('separates a declined permission prompt from a failure', async () => {
    const onApply = jest
      .fn()
      .mockRejectedValueOnce(new Error('declined'))
      .mockRejectedValueOnce(new Error('the helper did not run'));
    render(<AudioEngineDialog status={status()} onApply={onApply} />);

    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(applyButton());
    expect(await screen.findByText(en['engine.declined'])).toBeInTheDocument();
    // Re-enabled, so the prompt can be answered properly the second time.
    expect(applyButton()).toBeEnabled();

    fireEvent.click(applyButton());
    expect(await screen.findByText(en['engine.failed'])).toBeInTheDocument();
    expect(screen.queryByText(en['engine.declined'])).not.toBeInTheDocument();
  });

  it('puts the loud style on the recommendation and the quiet one on the decline', () => {
    render(
      <AudioEngineDialog
        status={status()}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(applyButton()).toHaveClass('button', 'small');
    expect(applyButton()).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: en['engine.cancel'] }),
    ).toHaveClass('button', 'small', 'subtle');
  });

  it('names the engine that is running now', () => {
    render(<AudioEngineDialog status={status()} onApply={jest.fn()} />);
    expect(
      screen.getByText(`Now: ${en['engine.apo.name']}`),
    ).toBeInTheDocument();
  });
});
