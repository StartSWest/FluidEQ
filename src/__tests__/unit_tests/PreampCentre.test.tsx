/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Both preamp controls stand 0 in the middle of their travel.
 *
 * The side panel's dial and the player's Pre fader run from -60 dB to +20. On
 * an even travel their 0 sat three quarters of the way round and three
 * quarters up, where a level doing nothing reads as one turned up (Ivan,
 * 2026-09-24: "center 0 on top not to the side"). Both carry a position, not
 * the value, so the position is what these read.
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import Knob from 'renderer/widgets/Knob';
import PlayerFader from 'renderer/player/PlayerFader';
import centredSweep from 'renderer/widgets/centredSweep';

const dial = (value: number) => {
  const handleChange = jest.fn(async () => undefined);
  const result = render(
    <Knob
      name="Preamp"
      value={value}
      min={-60}
      max={20}
      centre={0}
      step={0.01}
      unit="dB"
      isDisabled={false}
      handleChange={handleChange}
    />,
  );
  const input = result.container.querySelector('input[type="range"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('the dial has no range input');
  }
  return { ...result, input, handleChange };
};

const fader = (value: number, min: number) => {
  const onChange = jest.fn();
  const result = render(
    <PlayerFader
      ariaLabel="Preamp"
      label="PRE"
      value={value}
      min={min}
      max={20}
      step={0.1}
      zero={0}
      colour="#fff"
      isDisabled={false}
      onHold={() => undefined}
      onChange={onChange}
    />,
  );
  const input = result.container.querySelector('input[type="range"]');
  const band = result.container.querySelector('.player-band');
  if (!(input instanceof HTMLInputElement) || !(band instanceof HTMLElement)) {
    throw new Error('the fader is missing its parts');
  }
  return { ...result, input, band, onChange };
};

describe('the side panel preamp dial', () => {
  it('points straight up at 0 dB and reaches both ends', () => {
    expect(Number(dial(0).input.value)).toBe(0.5);
    expect(Number(dial(-60).input.value)).toBe(0);
    expect(Number(dial(20).input.value)).toBe(1);
  });

  it('still tells assistive tech the level, not the position', () => {
    const { input } = dial(-12);
    expect(input).toHaveAttribute('aria-valuenow', '-12');
    expect(input).toHaveAttribute('aria-valuemin', '-60');
  });

  it('turns a position into the level it stands for', () => {
    const { input, handleChange } = dial(0);
    const at = centredSweep(-60, 0, 20).toPosition(-30);
    fireEvent.change(input, { target: { value: String(at) } });
    expect(handleChange).toHaveBeenCalledWith(-30);
  });
});

describe("the player's Pre fader", () => {
  it('stands 0 dB in the middle, level with the bands', () => {
    const { input, band } = fader(0, -60);
    expect(Number(input.value)).toBe(0.5);
    expect(band.style.getPropertyValue('--player-fader-zero')).toBe('0.5');
    expect(input).toHaveAttribute('aria-valuenow', '0');
  });

  it('writes the level a position stands for, on the fader step', () => {
    const { input, onChange } = fader(0, -60);
    const at = centredSweep(-60, 0, 20).toPosition(-40);
    fireEvent.change(input, { target: { value: String(at) } });
    expect(onChange).toHaveBeenCalledWith(-40);
  });

  it('leaves a band fader on the even travel it always had', () => {
    const { input } = fader(10, -20);
    expect(Number(input.value)).toBeCloseTo(0.75, 10);
  });
});
