/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_STUDIO_DESCRIPTION,
  MAX_STUDIO_PROMPT,
  parseStudioNotes,
} from '../../../common/studioNotes';

describe('studio notes', () => {
  it('keep the description when the prompt is missing', () => {
    // The prompt is regenerated every time the scene opens, so its absence
    // is never a reason to lose what the member wrote.
    expect(parseStudioNotes({ description: 'Lanterns over a pond.' })).toEqual({
      description: 'Lanterns over a pond.',
    });
  });

  it('drop a prompt they cannot use instead of refusing the notes', () => {
    expect(
      parseStudioNotes({
        description: 'Lanterns over a pond.',
        prompt: 'x'.repeat(MAX_STUDIO_PROMPT + 1),
      }),
    ).toEqual({ description: 'Lanterns over a pond.' });
    expect(
      parseStudioNotes({ description: 'Lanterns over a pond.', prompt: 7 }),
    ).toEqual({ description: 'Lanterns over a pond.' });
  });

  it('keep a usable prompt and the What’s new line beside the description', () => {
    expect(
      parseStudioNotes({
        description: 'Lanterns over a pond.',
        prompt: 'The brief.',
        whatsNew: 'The petals fall more slowly.',
      }),
    ).toEqual({
      description: 'Lanterns over a pond.',
      prompt: 'The brief.',
      whatsNew: 'The petals fall more slowly.',
    });
  });

  it('still refuse notes without a usable description', () => {
    expect(parseStudioNotes({ prompt: 'only a prompt' })).toBeUndefined();
    expect(
      parseStudioNotes({ description: 'x'.repeat(MAX_STUDIO_DESCRIPTION + 1) }),
    ).toBeUndefined();
    expect(parseStudioNotes(null)).toBeUndefined();
  });
});
