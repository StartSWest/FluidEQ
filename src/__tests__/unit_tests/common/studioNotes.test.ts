/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_STUDIO_DESCRIPTION,
  notesHoldBrief,
  parseStudioNotes,
  storedStudioNotes,
} from '../../../common/studioNotes';

/**
 * A project's notes hold only the member's own: their idea and their AI's
 * line. FluidEQ's brief is built from the running FluidEQ wherever it is
 * used and never kept in a folder (Ivan, 2026-11-09); a brief an earlier
 * FluidEQ kept is dropped when the notes are read, and the idea it carried
 * after "MY IDEA:" is kept wherever it differs from the description.
 */
const BRIEF = 'You are a senior real-time graphics artist ...\n\nMY IDEA:';

describe('studio notes', () => {
  it('keep the description and the What’s new line', () => {
    expect(
      parseStudioNotes({
        description: 'Lanterns over a pond.',
        whatsNew: 'The petals fall more slowly.',
      }),
    ).toEqual({
      description: 'Lanterns over a pond.',
      whatsNew: 'The petals fall more slowly.',
    });
  });

  it('drop a brief an earlier FluidEQ kept, and nothing of the member’s with it', () => {
    expect(
      parseStudioNotes({
        description: 'Lanterns over a pond.',
        prompt: `${BRIEF} Lanterns over a pond.`,
        whatsNew: 'The petals fall more slowly.',
      }),
    ).toEqual({
      description: 'Lanterns over a pond.',
      whatsNew: 'The petals fall more slowly.',
    });
  });

  it('keep the idea a stored brief carried where the description says something else', () => {
    // ridgeline: an 890-character brief beside a 223-character description.
    const longer =
      'Ridgeline, a real spectrum analyser that looks like a landscape: the last eight seconds of the spectrum as glowing ridges.';
    expect(
      parseStudioNotes({
        description: 'A pro 3D spectrum analyser in a painted mountain range.',
        prompt: `${BRIEF} ${longer}\n`,
      }),
    ).toEqual({
      description: 'A pro 3D spectrum analyser in a painted mountain range.',
      earlierIdea: longer,
    });
  });

  it('keep an earlier idea already set apart, and never invent one', () => {
    expect(
      parseStudioNotes({ description: 'Now.', earlierIdea: 'Before.' }),
    ).toEqual({ description: 'Now.', earlierIdea: 'Before.' });
    expect(
      parseStudioNotes({ description: 'Now.', prompt: 'no idea marker' }),
    ).toEqual({ description: 'Now.' });
  });

  it('say whether notes as written still carry a brief', () => {
    expect(notesHoldBrief({ description: 'x', prompt: 'brief' })).toBe(true);
    expect(notesHoldBrief({ description: 'x' })).toBe(false);
    expect(notesHoldBrief(null)).toBe(false);
  });

  it('still refuse notes without a usable description', () => {
    expect(parseStudioNotes({ prompt: 'only a prompt' })).toBeUndefined();
    expect(
      parseStudioNotes({ description: 'x'.repeat(MAX_STUDIO_DESCRIPTION + 1) }),
    ).toBeUndefined();
    expect(parseStudioNotes(null)).toBeUndefined();
  });
});

describe('the What’s new line in every language', () => {
  it('is read as its English line and every language beside it', () => {
    const lines = { en: 'Peaks stay whole.', ja: '山が欠けなくなりました。' };
    expect(parseStudioNotes({ description: 'Peaks', whatsNew: lines })).toEqual(
      {
        description: 'Peaks',
        whatsNew: lines.en,
        whatsNewLines: lines,
      },
    );
  });

  it('is read alone, with no description, as the line alone always was', () => {
    expect(parseStudioNotes({ whatsNew: { en: 'Peaks.' } })).toEqual({
      description: '',
      whatsNew: 'Peaks.',
      whatsNewLines: { en: 'Peaks.' },
    });
  });

  it('is dropped, never the description, when it cannot be kept', () => {
    expect(
      parseStudioNotes({ description: 'Peaks', whatsNew: { xx: 'Gipfel' } }),
    ).toEqual({ description: 'Peaks' });
  });

  it('is written back under whatsNew itself', () => {
    const lines = { en: 'Peaks.', de: 'Gipfel.' };
    expect(
      storedStudioNotes({
        description: 'Peaks',
        whatsNew: 'Peaks.',
        whatsNewLines: lines,
        writtenAt: 5,
      }),
    ).toEqual({ description: 'Peaks', whatsNew: lines });
    // The control: notes with the English line alone keep it as it is.
    expect(
      storedStudioNotes({ description: 'Peaks', whatsNew: 'Peaks.' }),
    ).toEqual({ description: 'Peaks', whatsNew: 'Peaks.' });
  });
});
