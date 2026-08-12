/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  analyzeKaraokeChords,
  estimateKaraokeChord,
  KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
} from '../../../common/karaoke/chords';

describe('karaoke chord analysis', () => {
  it('distinguishes major and minor pitch-class templates', () => {
    const cMajor = new Float32Array(12);
    cMajor[0] = 1;
    cMajor[4] = 0.9;
    cMajor[7] = 0.8;
    const cBass = new Float32Array(12);
    cBass[0] = 1;

    const aMinor = new Float32Array(12);
    aMinor[9] = 1;
    aMinor[0] = 0.9;
    aMinor[4] = 0.8;
    const aBass = new Float32Array(12);
    aBass[9] = 1;

    expect(estimateKaraokeChord(cMajor, cBass)).toMatchObject({
      label: 'C',
      quality: 'major',
    });
    expect(estimateKaraokeChord(aMinor, aBass)).toMatchObject({
      label: 'Am',
      quality: 'minor',
    });
  });

  it('builds a stable chord segment from backing-audio PCM', async () => {
    const durationSeconds = 3;
    const samples = new Float32Array(
      KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE * durationSeconds,
    );
    const frequencies = [130.813, 164.814, 195.998];
    for (let index = 0; index < samples.length; index += 1) {
      const time = index / KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE;
      samples[index] = frequencies.reduce(
        (sum, frequency) =>
          sum + Math.sin(2 * Math.PI * frequency * time) * 0.18,
        0,
      );
    }

    const chords = await analyzeKaraokeChords(
      samples,
      KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
      { framesPerYield: 100 },
    );

    expect(chords).not.toHaveLength(0);
    expect(chords[0]).toMatchObject({ label: 'C', quality: 'major' });
    expect(chords[0].endMs - chords[0].startMs).toBeGreaterThan(1_000);
  });
});
