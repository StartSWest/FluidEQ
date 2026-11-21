/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useLayoutEffect } from 'react';

/** Room kept between the plate and the readouts, as the strip's other gaps. */
const CLEARANCE_PX = 8;
/** How far the wave fades out past the plate's ends, before the ellipse. */
const FADE_REACH_PX = 6;
/** The plate's padding under its words, which the wave may run into. */
const TEXT_INSET_PX = 2;
/**
 * Where the ellipse the wave parts with is fully clear, as a share of its
 * radius (`WavePreset.scss`): inside it nothing is drawn, from there to the
 * edge the trace comes back.
 */
const CLEAR_SHARE = 0.6;

/**
 * Where the plate may stand, and where the wave parts for it.
 *
 * The plate is centred over the meter for as long as the readouts at the
 * right leave it the room, and slides left into the caption's place when
 * they do not: the overlay's grid does that (`WavePreset.scss`), told how
 * wide the readouts are — the held peak, the recorder's loudness, a CLIP —
 * which change with the style and the music and are measured here.
 *
 * Then the wave is told where the plate ended up, so its drawing fades out
 * round it in an ellipse instead of running under the name: a mask on the
 * stage, in the stage's own pixels, since a stage that fills the meter's
 * height (the styles with a background of their own) starts higher than one
 * under the label row.
 *
 * Measured when anything that moves either changes size — the shell, the
 * readouts, the stage, the plate — never per frame: the drawing itself does
 * nothing more for the plate than it did before it.
 */
const useWavePresetRoom = (
  overlayRef: RefObject<HTMLElement | null>,
  /** What the plate is showing; a new plate is a new element to watch. */
  plateKey: string,
  /** The meter's label row is mounted (the meter switched off has none). */
  isMeterOn: boolean,
): void => {
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const shell = overlay?.parentElement;
    const plate = overlay?.querySelector<HTMLElement>('.wave-preset__plate');
    if (!overlay || !shell || !plate) {
      return undefined;
    }
    const readout = shell.querySelector<HTMLElement>(
      '.waveform-visualizer__readout',
    );
    const stage = shell.querySelector<HTMLElement>(
      '.waveform-visualizer__stage',
    );
    const measure = () => {
      const shellBox = shell.getBoundingClientRect();
      const readoutBox = readout?.getBoundingClientRect();
      // Nothing showing in the readouts (the meter off, or every figure
      // given up to a narrow meter): the plate may use the whole row.
      const room =
        readoutBox && readoutBox.width > 0
          ? shellBox.right - readoutBox.left + CLEARANCE_PX
          : 0;
      overlay.style.setProperty('--wave-readout-room', `${room}px`);
      if (!stage) {
        return;
      }
      // Read after the room is set, so this is where the plate now stands.
      const plateBox = plate.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const halfWidth = plateBox.width / 2 + FADE_REACH_PX;
      // To the foot of its words, not of its box: the box has two pixels
      // of padding under them, and a wave held off those as well read as a
      // break in a quiet trace that was nowhere near the name.
      const halfHeight = plateBox.height / 2 - TEXT_INSET_PX;
      shell.style.setProperty(
        '--wave-plate-x',
        `${plateBox.left + plateBox.width / 2 - stageBox.left}px`,
      );
      shell.style.setProperty(
        '--wave-plate-y',
        `${plateBox.top + plateBox.height / 2 - stageBox.top}px`,
      );
      shell.style.setProperty(
        '--wave-plate-rx',
        `${halfWidth / CLEAR_SHARE}px`,
      );
      shell.style.setProperty(
        '--wave-plate-ry',
        `${halfHeight / CLEAR_SHARE}px`,
      );
    };
    measure();
    shell.dataset.wavePlate = '';
    const observer = new ResizeObserver(measure);
    [shell, plate, readout, stage].forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });
    return () => {
      observer.disconnect();
      delete shell.dataset.wavePlate;
    };
  }, [overlayRef, plateKey, isMeterOn]);
};

export default useWavePresetRoom;
