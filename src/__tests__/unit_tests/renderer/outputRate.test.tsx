/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The output's rate beside the equaliser's name, as the DSP page has its own
 * (Ivan, 2026-09-22: "put the Hz also in the main EQ similar to DSP, the real
 * output thing"): the rate Windows runs the output being listened to at, read
 * again when the output changes and when the window is come back to.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IAudioDevice } from '../../../common/constants';
import OutputRate from '../../../renderer/components/OutputRate';
import { formatRateKhz } from '../../../renderer/components/TitleRate';
import { getAudioDevices } from '../../../renderer/utils/equalizerApi';

jest.mock('../../../renderer/utils/equalizerApi', () => {
  const getAudioDevices = jest.fn();
  return {
    getAudioDevices,
    // Open-time readers take the kept list; here it is the same answer.
    readKnownAudioDevices: () => getAudioDevices(),
  };
});

const outputs = (defaultRate: number | undefined): IAudioDevice[] => [
  {
    id: 'other',
    name: 'Monitor',
    guid: '{other}',
    isDefault: false,
    isActive: true,
    sampleRate: 96_000,
  },
  {
    id: 'listened',
    name: 'Headphones',
    guid: '{listened}',
    isDefault: true,
    isActive: true,
    sampleRate: defaultRate,
  },
];

beforeEach(() => {
  jest.mocked(getAudioDevices).mockReset();
});

it('names the rate of the output being listened to, not of another', async () => {
  jest.mocked(getAudioDevices).mockResolvedValue(outputs(44_100));
  render(<OutputRate />);
  expect(await screen.findByText('44.1 kHz')).toBeInTheDocument();
  expect(screen.queryByText('96 kHz')).not.toBeInTheDocument();
});

it('reads it again when the output changes and when the window is back', async () => {
  jest.mocked(getAudioDevices).mockResolvedValue(outputs(48_000));
  render(<OutputRate />);
  expect(await screen.findByText('48 kHz')).toBeInTheDocument();

  jest.mocked(getAudioDevices).mockResolvedValue(outputs(96_000));
  await act(async () => {
    window.dispatchEvent(new Event('fluideq-output-changed'));
  });
  expect(await screen.findByText('96 kHz')).toBeInTheDocument();

  // A format changed in Sound settings, away from this window.
  jest.mocked(getAudioDevices).mockResolvedValue(outputs(192_000));
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(await screen.findByText('192 kHz')).toBeInTheDocument();
});

it('shows nothing for an output Windows would not describe', async () => {
  jest.mocked(getAudioDevices).mockResolvedValue(outputs(undefined));
  const { container } = render(<OutputRate />);
  await act(async () => {
    await Promise.resolve();
  });
  // POSITIVE CONTROL: the list was read, so nothing is a finding.
  expect(getAudioDevices).toHaveBeenCalled();
  expect(container).toBeEmptyDOMElement();
});

it('writes a rate as the DSP page always has', () => {
  expect(formatRateKhz(44_100)).toBe('44.1 kHz');
  expect(formatRateKhz(48_000)).toBe('48 kHz');
  expect(formatRateKhz(88_200)).toBe('88.2 kHz');
  expect(formatRateKhz(192_000)).toBe('192 kHz');
});
