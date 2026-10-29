/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Linux window leaves out: Equalizer APO, which is a Windows
 * program, the per-output engine repairs, which are Windows' effect slots,
 * and Dynamic lighting and desktop backgrounds, which go through Windows
 * alone. Each case renders the same thing on Windows beside it, so "not
 * there" is told apart from "never drawn".
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { IAudioEngineStatus } from 'common/audioEngine';
import en from 'common/i18n/en';
import AudioEngineDialog from 'renderer/components/AudioEngineDialog';
import AudioTroubleshooter from 'renderer/components/AudioTroubleshooter';
import { featureTourFor } from 'renderer/components/featureTour/slides';
import shownHelpChapters from 'renderer/help/shownHelpChapters';

const onPlatform = (platform: string) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { platform },
  });
};

afterAll(() => {
  Reflect.deleteProperty(window, 'electron');
});

const status: IAudioEngineStatus = {
  engine: 'fluid',
  apo: { installed: false },
  fluid: { installed: true, endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
};

const renderTroubleshooter = () =>
  render(
    <AudioTroubleshooter
      engine="fluid"
      onClose={jest.fn()}
      onRestartAudio={jest.fn()}
      onReconfigure={jest.fn()}
      onReinstallApo={jest.fn()}
      onEnableEngine={jest.fn()}
      onRemoveEngineFromOutput={jest.fn()}
    />,
  );

const tourIds = () => featureTourFor('2.1.0').map((slide) => slide.id);
const chapterIds = () => shownHelpChapters().map((chapter) => chapter.id);

describe.each([
  ['win32', true],
  ['linux', false],
])('on %s', (platform, showsWindowsOnly) => {
  beforeEach(() => onPlatform(platform));

  it('offers Equalizer APO and Apply only where there is a choice', () => {
    render(
      <AudioEngineDialog
        status={status}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(showsWindowsOnly ? 2 : 1);
    expect(
      screen.queryByRole('radio', { name: en['engine.apo.name'] }) !== null,
    ).toBe(showsWindowsOnly);
    expect(
      screen.queryByRole('button', { name: en['engine.apply'] }) !== null,
    ).toBe(showsWindowsOnly);
    expect(
      screen.getByRole('radio', { name: en['engine.fluid.name'] }),
    ).toBeInTheDocument();
  });

  it('offers the per-output engine repairs only on Windows', () => {
    renderTroubleshooter();
    expect(
      screen.queryByRole('button', { name: en['output.enable'] }) !== null,
    ).toBe(showsWindowsOnly);
    expect(
      screen.getByRole('button', { name: en['restart.action'] }),
    ).toBeInTheDocument();
  });

  it('tells of Dynamic lighting and desktop backgrounds only on Windows', () => {
    expect(tourIds().includes('dynamic-lighting')).toBe(showsWindowsOnly);
    expect(tourIds().includes('desktop-visualizer')).toBe(showsWindowsOnly);
    expect(tourIds()).toContain('fluideq-engine');
    expect(chapterIds().includes('lighting')).toBe(showsWindowsOnly);
    expect(chapterIds().includes('desktop')).toBe(showsWindowsOnly);
    expect(chapterIds()).toContain('engine');
  });

  // The tray slide draws Windows' taskbar and says "sign in to Windows"; the
  // walkthrough was recorded on Windows too and Linux shows it all the same
  // (Ivan, 2026-10-29), so the film is the control beside the hidden slide.
  it('tells of starting in the tray only on Windows, and plays the walkthrough on both', () => {
    const ids = featureTourFor('2.2.0').map((slide) => slide.id);
    expect(ids.includes('tray-start')).toBe(showsWindowsOnly);
    expect(ids[0]).toBe('walkthrough');
    expect(ids).toContain('languages');
  });
});
