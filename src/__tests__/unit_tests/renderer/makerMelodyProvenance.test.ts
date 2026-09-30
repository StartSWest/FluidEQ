/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  RMVPE_PROVENANCE,
  SWIFT_F0_PROVENANCE,
  analyzeKaraokeWithSwiftF0,
} from 'renderer/karaoke/makerAi/swiftF0Notes';

// Decoding needs an AudioContext jsdom does not have; what is decoded does
// not matter to which model signs the result.
jest.mock('renderer/karaoke/makerAi/audio', () => ({
  decodeMono: () => Promise.resolve(new Float32Array(1_600)),
}));

const original = window.electron;
afterEach(() => {
  window.electron = original;
});

/** The main process answering a detection with `model`. */
const answeredBy = (model: 'rmvpe' | 'swift-f0') => {
  window.electron = {
    ipcRenderer: {
      onKaraokePitchProgress: () => () => undefined,
      detectKaraokePitch: () =>
        Promise.resolve({
          pitchHz: [220, 220, 220, 220],
          confidence: [0.9, 0.9, 0.9, 0.9],
          hopSeconds: 0.016,
          voicedThreshold: 0.5,
          model,
        }),
    },
  } as unknown as typeof window.electron;
};

const file = () => new File([new Uint8Array(4)], 'song.mp3');

// A Maker project names the model whose notes it carries, and an exported
// project carries that record to whoever sings it. RMVPE is tried first and
// answers most runs, and its notes were recorded as SwiftF0's, crediting a
// model that had found none of them.
it('credits RMVPE for a melody RMVPE detected', async () => {
  answeredBy('rmvpe');
  const { provenance } = await analyzeKaraokeWithSwiftF0(file(), () => {});
  expect(provenance).toEqual(RMVPE_PROVENANCE);
  expect(provenance.sourceUrl).toBe(
    'https://huggingface.co/lj1995/VoiceConversionWebUI',
  );
});

it('credits SwiftF0 when the bundled model answered', async () => {
  answeredBy('swift-f0');
  const { provenance } = await analyzeKaraokeWithSwiftF0(file(), () => {});
  expect(provenance).toEqual(SWIFT_F0_PROVENANCE);
});
