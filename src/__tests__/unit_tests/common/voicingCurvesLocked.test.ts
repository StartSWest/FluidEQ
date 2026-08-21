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

import { VOICING_PROFILES } from '../../../common/voicing';

/**
 * THE VOICING CURVES ARE LOCKED. THIS IS THE LOCK.
 *
 * Every other test in this suite checks that the code does what it says. This
 * one checks that nobody changed what it says — because these numbers are the
 * product. They were arrived at by listening, they are the reason FluidEQ
 * sounds like FluidEQ, and nothing else in the repository can tell you that
 * they have been made worse. A wrong decibel here compiles, passes every type
 * check, draws a plausible curve, and quietly ships a different product.
 *
 * So the rule is not "be careful", it is: CHANGING ANY VALUE BELOW REQUIRES THE
 * OWNER'S EXPLICIT AUTHORISATION, ASKED FOR AND GIVEN, EVERY TIME. Anyone,
 * human or otherwise. Especially for changes that look trivial — a rounding, a
 * tidy-up, a "surely 0.7 was meant to be 0.71" — because those are the ones
 * that get waved through.
 *
 * IF THIS TEST IS FAILING AND YOU DID NOT MEAN TO CHANGE THE SOUND, THE BUG IS
 * YOUR EDIT. Fix the edit, not this file. If you did mean to, get authorisation
 * first and update the expectation in the same commit, so the diff reads as a
 * decision instead of an accident.
 *
 * Adding a new profile is allowed and deliberately not locked: a new row breaks
 * nobody's sound. Editing an existing one does.
 */

/** type/frequency/gain/Q for each filter, in order, joined per profile. */
const signatureOf = (filters: (typeof VOICING_PROFILES)[number]['filters']) =>
  filters
    .map((f) => [f.type, f.frequency, f.gain, f.quality].join('/'))
    .join(' | ');

/**
 * The curves as they are meant to be, written out rather than snapshotted.
 *
 * A jest snapshot would let `-u` rewrite the product's sound in one keystroke
 * and leave a diff nobody reads. Spelling them out means changing one is an
 * edit somebody had to type on purpose, in a file that says why they should
 * not have.
 */
const LOCKED: Record<string, string> = {
  music: 'LSC/105/3.5/0.7 | PK/300/-1.5/1 | HSC/10000/2/0.7',
  movies: 'LSC/80/4/0.7 | PK/350/-2.5/1.2 | PK/2800/3/1 | HSC/12000/1.5/0.7',
  games: 'HPQ/30/0/0.7 | PK/200/-2/1 | PK/4500/4/1.4 | PK/8000/2/1.5',
  speech: 'HPQ/85/0/0.7 | PK/300/-3/1.2 | PK/2200/4/1 | PK/7000/-2/2',
  loudness: 'LSC/120/6/0.7 | PK/1000/-1/0.8 | HSC/8000/4/0.7',
  rock: 'LSC/90/3/0.7 | PK/420/-2.5/1 | PK/3200/2.5/1 | HSC/9000/1.5/0.7',
  metal:
    'HPQ/32/0/0.7 | LSC/85/2.5/0.7 | PK/450/-3/1.1 | PK/3400/3/1.1 | HSC/9000/1.5/0.7',
  pop: 'LSC/75/3/0.7 | PK/320/-2/1.1 | PK/2600/2.5/1 | HSC/10000/2.5/0.7',
  hiphop: 'LSC/60/4.5/0.7 | PK/260/-2.5/1.1 | PK/2800/2/1 | HSC/11000/1.5/0.7',
  electronic:
    'LSC/70/4/0.7 | PK/360/-3/1.2 | PK/4200/2/1.2 | HSC/12000/2.5/0.7',
  jazz: 'LSC/100/2/0.7 | PK/400/-1.5/1 | PK/3500/1.5/1.2 | HSC/11000/1.5/0.7',
  classical: 'LSC/120/1.5/0.7 | PK/350/-1.5/1 | HSC/10000/2/0.7',
  acoustic: 'PK/200/-2/1 | PK/2400/2/1 | HSC/10000/2/0.7',
};

describe('the voicing curves are locked', () => {
  it.each(Object.keys(LOCKED))(
    '%s is exactly as it was tuned',
    (id: string) => {
      const profile = VOICING_PROFILES.find((entry) => entry.id === id);
      expect(profile).toBeDefined();
      expect(signatureOf(profile!.filters)).toBe(LOCKED[id]);
    },
  );

  it('has not lost a profile', () => {
    // Adding one is fine and expected. Removing or renaming one takes a tuning
    // somebody relies on away from them, which is the same decision as editing
    // it and needs the same authorisation.
    Object.keys(LOCKED).forEach((id) => {
      expect(VOICING_PROFILES.map((entry) => entry.id)).toContain(id);
    });
  });

  it('states the rule where the curves are, not only here', () => {
    // The lock is worth as little as the chance of somebody reading it. Anyone
    // editing the table sees the file, not this test, so the warning has to be
    // there too — and this asserts it still is.
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const source: string = require('fs').readFileSync(
      'src/common/voicing.ts',
      'utf8',
    );
    expect(source).toContain('DO NOT TOUCH THESE CURVES');
    expect(source).toContain("OWNER'S EXPLICIT AUTHORISATION");
  });
});
