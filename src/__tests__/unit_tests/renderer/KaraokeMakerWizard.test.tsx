/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import KaraokeMakerWizard from 'renderer/karaoke/KaraokeMakerWizard';
import { I18nProvider } from 'renderer/utils/I18nContext';
import {
  karaokeMakerHasCompleteTiming,
  IKaraokeMakerLine,
} from 'common/karaoke/makerProject';

const show = (node: ReactElement) =>
  render(<I18nProvider>{node}</I18nProvider>);

const wizard = (over: Record<string, unknown> = {}) => {
  const props = {
    activeStep: undefined as 'separate' | 'transcribe' | undefined,
    doneSteps: [] as ('separate' | 'transcribe')[],
    progress: undefined as number | undefined,
    message: undefined as string | undefined,
    onStart: jest.fn(),
    onSkip: jest.fn(),
    onCancel: jest.fn(),
    onHide: jest.fn(),
    language: undefined as string | undefined,
    onLanguage: jest.fn(),
    ...over,
  };
  show(
    <KaraokeMakerWizard
      activeStep={props.activeStep}
      doneSteps={props.doneSteps}
      progress={props.progress}
      message={props.message}
      onStart={props.onStart}
      onSkip={props.onSkip}
      onCancel={props.onCancel}
      onHide={props.onHide}
      language={props.language}
      onLanguage={props.onLanguage}
    />,
  );
  return props;
};

const line = (
  tokens: { text: string; startMs?: number; endMs?: number }[],
  kind: 'lyric' | 'section' = 'lyric',
): IKaraokeMakerLine =>
  ({
    id: `line-${tokens.map((token) => token.text).join('-')}`,
    kind,
    tokens: tokens.map((token, index) => ({ id: `t${index}`, ...token })),
  }) as unknown as IKaraokeMakerLine;

/**
 * When the Maker offers to set a song up, and what it offers.
 *
 * The condition matters more than the dialog. Offering to re-detect a song that
 * is already finished invites someone to overwrite timing they placed by hand,
 * and there is no undo across a full re-run.
 */
describe('deciding whether a song needs setting up', () => {
  it('treats a song with every word timed as already done', () => {
    expect(
      karaokeMakerHasCompleteTiming([
        line([{ text: 'hello', startMs: 0, endMs: 500 }]),
      ]),
    ).toBe(true);
  });

  it('treats a lyric sheet with no timings as needing work', () => {
    expect(karaokeMakerHasCompleteTiming([line([{ text: 'hello' }])])).toBe(
      false,
    );
  });

  it('treats a half-timed song as needing work', () => {
    // The case worth catching: someone stopped partway. Requiring only "some
    // timing exists" would call this finished and leave them stranded.
    expect(
      karaokeMakerHasCompleteTiming([
        line([{ text: 'hello', startMs: 0, endMs: 500 }]),
        line([{ text: 'world' }]),
      ]),
    ).toBe(false);
  });

  it('ignores section markers, which never carry timing', () => {
    // Counting them would make every finished project look unfinished and
    // re-run detection over completed work.
    expect(
      karaokeMakerHasCompleteTiming([
        line([{ text: '[Chorus]' }], 'section'),
        line([{ text: 'hello', startMs: 0, endMs: 500 }]),
      ]),
    ).toBe(true);
  });

  it('does not call an empty project finished', () => {
    expect(karaokeMakerHasCompleteTiming([])).toBe(false);
  });

  it('rejects a token whose end does not follow its start', () => {
    // A zero-length or reversed word is a timing that exists and means nothing.
    expect(
      karaokeMakerHasCompleteTiming([
        line([{ text: 'hello', startMs: 500, endMs: 500 }]),
      ]),
    ).toBe(false);
  });
});

describe('the Maker setup wizard', () => {
  it('offers both steps in the order they must run', () => {
    wizard();
    const steps = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatch(/Separate the voice/);
    expect(steps[1]).toMatch(/Read the words/);
  });

  it('lets the user decline without starting anything', () => {
    // Declining has to be as reachable as accepting. The manual tools are a
    // complete way to do this work and some people prefer them.
    const { onSkip, onStart } = wizard();
    fireEvent.click(
      screen.getByRole('button', { name: /I will do it myself/ }),
    );
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts on request', () => {
    const { onStart } = wizard();
    fireEvent.click(
      screen.getByRole('button', { name: /Set up automatically/ }),
    );
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('replaces the choice with a way out once it is running', () => {
    // Start and Skip are answers to a question that has been answered. Leaving
    // them up would let a second run be launched over the first.
    wizard({ activeStep: 'separate', progress: 0.4 });
    expect(
      screen.queryByRole('button', { name: /Set up automatically/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stop/ })).toBeInTheDocument();
  });

  it('cancels the run rather than dismissing the dialog', () => {
    const { onCancel } = wizard({ activeStep: 'transcribe' });
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('marks which step is running and which is finished', () => {
    wizard({ activeStep: 'transcribe', doneSteps: ['separate'] });
    const [separate, transcribe] = screen.getAllByRole('listitem');
    expect(separate.className).toMatch(/is-done/);
    expect(transcribe).toHaveAttribute('aria-current', 'step');
    expect(separate).not.toHaveAttribute('aria-current');
  });

  it('shows an indeterminate bar until a step reports a number', () => {
    // A step that has started but not yet reported is not at zero percent, and
    // a bar pinned at zero reads as stuck.
    wizard({ activeStep: 'separate', message: 'Reading the song' });
    const bar = screen.getByRole('status').querySelector('progress');
    expect(bar).not.toBeNull();
    expect(bar).not.toHaveAttribute('value');
  });

  it('reports the running step to assistive technology as it changes', () => {
    wizard({
      activeStep: 'separate',
      progress: 0.5,
      message: 'Separating the voice from the music',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      /Separating the voice/,
    );
  });

  it('gives every action the styling that makes it visible', () => {
    // This dialog shipped once with bare <button> elements. Every test above
    // still passed — they query by role, and an unstyled button has a role
    // just like a styled one — while on screen the browser's default control
    // on a dark panel was close to invisible, so the dialog looked as though
    // it offered no choices at all.
    //
    // `button small` is what every other button in the app wears. Asserting it
    // is crude, but the alternative is a class of bug that no query-by-role
    // test can see.
    wizard();
    ['I will do it myself', 'Set up automatically'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toHaveClass(
        'button',
        'small',
      );
    });
    wizard({ activeStep: 'separate' });
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveClass(
      'button',
      'small',
    );
  });
  it('can be dismissed while running without stopping the run', () => {
    // The same escape the lyric detection has. Cancel means stop the work;
    // this means only close the window — conflating them cost a user a
    // finished 700 MB download once.
    const { onHide, onCancel } = wizard({ activeStep: 'separate' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue in background' }),
    );
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
