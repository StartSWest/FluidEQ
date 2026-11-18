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
  KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
} from '../../../common/karaoke/chords';

/** `seconds` of the notes at `frequencies` together, at the analysis rate. */
const chordPcm = (frequencies: readonly number[], seconds = 3) => {
  const samples = new Float32Array(
    KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE * seconds,
  );
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE;
    samples[index] = frequencies.reduce(
      (sum, frequency) => sum + Math.sin(2 * Math.PI * frequency * time) * 0.18,
      0,
    );
  }
  return samples;
};

const C_MAJOR = [130.813, 164.814, 195.998];
const A_MINOR = [110, 130.813, 164.814];

// The ear names majors and minors from the song's audio (2026-11-16: peaks,
// tuning, harmonics and one decision over the song); the per-frame template
// it used to expose went with that rewrite, so the two are told apart here
// the way the player asks, from PCM.
describe('karaoke chord analysis', () => {
  it('tells a minor chord from the major one sharing two of its notes', async () => {
    const [minor] = await analyzeKaraokeChords(
      chordPcm(A_MINOR),
      KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
      { framesPerYield: 100 },
    );
    expect(minor).toMatchObject({ label: 'Am' });
    // The control: C, E and G, two of A minor's notes and a third, is C.
    const [major] = await analyzeKaraokeChords(
      chordPcm(C_MAJOR),
      KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
      { framesPerYield: 100 },
    );
    expect(major).toMatchObject({ label: 'C' });
  });

  it('builds a stable chord segment from backing-audio PCM', async () => {
    const chords = await analyzeKaraokeChords(
      chordPcm(C_MAJOR),
      KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
      { framesPerYield: 100 },
    );

    expect(chords).not.toHaveLength(0);
    expect(chords[0]).toMatchObject({ label: 'C' });
    expect(chords[0].endMs - chords[0].startMs).toBeGreaterThan(1_000);
    expect(chords[0].confidence).toBeGreaterThan(0);
    expect(chords[0].confidence).toBeLessThanOrEqual(1);
  });

  it('hears nothing in silence', async () => {
    expect(
      await analyzeKaraokeChords(
        new Float32Array(KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE * 2),
        KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
      ),
    ).toEqual([]);
  });
});
