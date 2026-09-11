/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * Which repairs the panel offers, and to whom.
 *
 * Three of its steps are Equalizer APO's own — its Device Selector, its two
 * installation modes, its installer — and offering those to somebody running
 * the FluidEQ Engine sends them into a program that is not carrying their
 * audio. The engine's own two steps have the mirror-image problem, and the
 * second of them (taking the engine off an output) was wired end to end and
 * reachable from nowhere at all.
 *
 * Plain `toBeNull` rather than jest-dom's `toBeInTheDocument`: this suite
 * does not load jest-dom, and one test file reaching for a matcher the rest
 * of the suite does not have is a dependency nobody asked for.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import AudioTroubleshooter from '../../../renderer/components/AudioTroubleshooter';

const handlers = () => ({
  onClose: jest.fn(),
  onRestartAudio: jest.fn(),
  onReconfigure: jest.fn(),
  onReinstallApo: jest.fn(),
  onEnableEngine: jest.fn(),
  onRemoveEngineFromOutput: jest.fn(),
});

const renderPanel = (
  engine: 'apo' | 'fluid' | null,
  props: ReturnType<typeof handlers>,
) =>
  render(
    <AudioTroubleshooter
      engine={engine}
      enableEngineLabel="Enable engine"
      onClose={props.onClose}
      onRestartAudio={props.onRestartAudio}
      onReconfigure={props.onReconfigure}
      onReinstallApo={props.onReinstallApo}
      onEnableEngine={props.onEnableEngine}
      onRemoveEngineFromOutput={props.onRemoveEngineFromOutput}
    />,
  );

const button = (name: string) => screen.queryByRole('button', { name });

describe('the audio troubleshooter', () => {
  it('offers both engine steps under the FluidEQ Engine', () => {
    renderPanel('fluid', handlers());

    expect(button('Enable engine')).not.toBeNull();
    expect(button('Remove from this output')).not.toBeNull();
    // And none of Equalizer APO's, which that machine may not even have.
    expect(button('Open Device Selector')).toBeNull();
  });

  it('runs the removal handler when the quiet step is pressed', () => {
    const props = handlers();
    renderPanel('fluid', props);

    const remove = button('Remove from this output');
    expect(remove).not.toBeNull();
    fireEvent.click(remove as HTMLElement);

    expect(props.onRemoveEngineFromOutput).toHaveBeenCalledTimes(1);
    expect(props.onEnableEngine).not.toHaveBeenCalled();
  });

  it('offers neither engine step under Equalizer APO', () => {
    renderPanel('apo', handlers());

    expect(button('Enable engine')).toBeNull();
    expect(button('Remove from this output')).toBeNull();
    // The positive control: Equalizer APO's own repairs are there instead, so
    // "neither engine step" cannot pass by the panel rendering nothing.
    expect(
      screen.getAllByRole('button', { name: 'Open Device Selector' }).length,
    ).toBe(2);
  });

  it('offers only the engine-neutral restart while the engine is unknown', () => {
    renderPanel(null, handlers());

    expect(button('Restart audio')).not.toBeNull();
    expect(button('Remove from this output')).toBeNull();
    expect(button('Open Device Selector')).toBeNull();
  });

  // The restart card opens over this panel and handles its own Escape; one
  // press used to close both and lose the record of what had been tried.
  it('leaves an Escape alone that a card in front already handled', () => {
    const props = handlers();
    renderPanel('fluid', props);

    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    expect(props.onClose).not.toHaveBeenCalled();

    // Positive control: an Escape nobody handled still closes the panel.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
