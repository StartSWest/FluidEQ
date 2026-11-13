/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What each signal must never drive (`aiPromptSignals.ts`), in every brief
 * (Ivan, 2026-11-13: "we can do forbid lists so he knows better what not to
 * use for what", and the voice "only for scenes that involve characters
 * singing or speaking"). Bans, not recipes; and what the brief says of the
 * bands is how they are heard now.
 */

import { chatPrompt, promptWithIdea } from '../../../renderer/studio/aiPrompt';
import SIGNALS_SECTION from '../../../renderer/studio/aiPromptSignals';

const SIGNALS = [
  'uBands.x',
  'uBands.y',
  'uBands.z',
  'uLevel',
  'uBeat',
  'uDrums',
  'uRhythm',
  'uSong',
  'uMusicAccent',
  'uMusicRun',
  'uSpectrum',
  'uStereo',
  'uVoice',
];

/** The section's entries, one a signal: from its "- uName" to the next. */
const entries = SIGNALS_SECTION.split(/\n(?=- u)/).slice(1);

describe('what each signal must never drive', () => {
  it('has an entry for every signal a scene hears, each with a ban', () => {
    SIGNALS.forEach((signal) => {
      const entry = entries.find((text) => text.startsWith(`- ${signal}`));
      expect(entry).toBeDefined();
      expect(entry).toContain('NEVER');
    });
    // The control: nothing else is an entry.
    expect(entries.length).toBe(SIGNALS.length);
  });

  it('keeps the voice for a character who sings or speaks, and for nothing else', () => {
    const voice = entries.find((text) => text.startsWith('- uVoice')) ?? '';
    expect(voice).toContain('ONLY for a character who sings or speaks');
    expect(voice).toMatch(
      /A scene with no such\s+character NEVER reads uVoice/,
    );
    expect(voice).toMatch(/NEVER for lights, colours, particles, scenery/);
    // The other signals carry no such "ONLY": theirs are bans alone.
    entries
      .filter((text) => !text.startsWith('- uVoice'))
      .forEach((text) => expect(text).not.toContain('ONLY for'));
  });

  it('says what is banned and leaves what to draw to the maker', () => {
    expect(SIGNALS_SECTION).toContain('nothing below says what to draw');
    // The recipes that every scene came back with.
    ['floor pulse', 'a spark', 'a glint', 'confetti'].forEach((recipe) =>
      expect(SIGNALS_SECTION).not.toContain(recipe),
    );
  });
});

// The Studio's own chat reads one, an AI the member pastes it to the other.
describe.each([
  ['the chat', chatPrompt()],
  ['a copied prompt', promptWithIdea('a pond')],
])('the brief around it, for %s', (_name, brief) => {
  it('carries the section whole, before the dance', () => {
    expect(brief).toContain(SIGNALS_SECTION);
    expect(brief.indexOf('WHAT EACH SIGNAL IS, AND')).toBeLessThan(
      brief.indexOf('DANCING TO THE MUSIC\n'),
    );
  });

  it('describes the bands as they are heard, not as they once were', () => {
    expect(brief).toContain('x = bass (the kick and the bass line)');
    // Until 2026-11-13 it still gave the ranges the bands had before
    // 2026-09-24, and told the voice was for "anything that follows a voice".
    expect(brief).not.toContain('20-160 Hz');
    expect(brief).not.toContain('anything that\n  follows a voice');
    expect(brief).not.toContain('a floor pulse');
  });
});
