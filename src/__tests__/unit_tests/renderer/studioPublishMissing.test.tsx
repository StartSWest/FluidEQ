/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan, 2026-11-14: "the button is disabled with no reason on the publish
 * screen". The reason sat in small grey type beside Cancel and read as
 * nothing. The footer now names every missing part with the section it is
 * under, each a way there, and Send — held, never disabled for a missing
 * part — goes to the first of them, outlining it once.
 */

const identity = { loaded: true, missing: false };
// Where the camera says its take stands, how many the press asked for, and
// whether a clip waits for the test to land it (`emit`).
const take: {
  phase: string;
  asked: number;
  deferred: boolean;
  emit?: () => void;
} = { phase: 'idle', asked: 0, deferred: false };
jest.mock('../../../renderer/plus/profileStore', () => ({
  usePublicIdentity: () => identity,
  createProfile: jest.fn(() => Promise.resolve(true)),
  useProfile: () => ({ saving: false, error: undefined }),
  clearProfileError: jest.fn(),
}));
// A camera that reports its take as `take.phase` says, and makes a clip at
// once when the press asks for one, inside a video section like the real
// one's.
jest.mock('../../../renderer/studio/StudioPublishCamera', () => {
  const { useLayoutEffect } =
    jest.requireActual<typeof import('react')>('react');
  return function Camera({
    source,
    onPreview,
    onTake,
    recordRef,
  }: {
    source: string;
    onPreview: (value: unknown) => void;
    onTake?: (phase: string) => void;
    recordRef: { current: (() => void) | undefined };
  }) {
    useLayoutEffect(() => {
      onTake?.(take.phase);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reported once per mount
    }, []);
    recordRef.current = () => {
      take.asked += 1;
      const emit = () =>
        onPreview({
          source,
          blob: new Blob(['clip']),
          durationMs: 10000,
          width: 640,
          height: 360,
        });
      if (take.deferred) {
        take.emit = emit;
      } else {
        emit();
      }
    };
    return <section data-publish-part="video" />;
  };
});
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { loadLocale, LOCALES, translate } from '../../../common/i18n';
import type { IScenePack } from '../../../common/scenePacks';
import { VERSION_NOTE_LOCALES } from '../../../common/sceneVersionNote';
import StudioPublishDialog from '../../../renderer/studio/StudioPublishDialog';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';
/* eslint-enable import/first */

const pack = {
  schema: 1,
  id: 'alpine',
  version: 1,
  contract: 1,
  names: { en: 'Alpine' },
  fallbackStyle: 'skyline',
  swatch: ['#000000', '#ffffff'],
  source: '',
  params: [],
} as unknown as IScenePack;

// The line in every language, as the chat writes it: a press then sends.
const EVERY_LANGUAGE = Object.fromEntries(
  VERSION_NOTE_LOCALES.map((locale) => [
    locale,
    `A mountain lake (${locale}).`,
  ]),
) as IPublishDraft['suggestedNotes'];

const dialog = (
  more: Partial<IPublishDraft> = {},
  onPublish: jest.Mock = jest.fn(),
  onWriteNote: (() => Promise<boolean>) | undefined = undefined,
) => (
  <StudioPublishDialog
    name="Alpine"
    identity="alpine"
    pack={pack}
    tuning={{}}
    onCapture={jest.fn()}
    onChoose={jest.fn()}
    draft={{ shots: [], chosen: 0, missed: false, agreed: true, ...more }}
    running={false}
    onPublish={onPublish}
    onTranslateNote={jest.fn().mockResolvedValue(false)}
    onWriteNote={onWriteNote}
    onCancel={jest.fn()}
  />
);

const open = (
  more: Partial<IPublishDraft> = {},
  onPublish: jest.Mock = jest.fn(),
  onWriteNote: (() => Promise<boolean>) | undefined = undefined,
) => render(dialog(more, onPublish, onWriteNote));

const send = () =>
  screen.getByRole('button', { name: 'studio.publish.goReview' });
const part = (name: string) =>
  document.querySelector<HTMLElement>(`[data-publish-part="${name}"]`);
const scrolled = jest.fn();

beforeAll(() => {
  Element.prototype.scrollIntoView = scrolled;
});
beforeEach(() => {
  scrolled.mockClear();
  identity.missing = false;
  take.phase = 'idle';
  take.asked = 0;
  take.deferred = false;
  take.emit = undefined;
});

describe('a press while a part is missing', () => {
  it('goes to the first missing part, focuses it and outlines it, and sends nothing', () => {
    const onPublish = jest.fn();
    open({}, onPublish);
    // Ivan, 2026-11-14: "enable the button, so when they click they can tell
    // which is the error". Never dead, and the list quiet until a press: not
    // disabled, not marked held (the app draws aria-disabled as the dim
    // outline), and in its loud style.
    expect(send()).toBeEnabled();
    expect(send()).not.toHaveAttribute('aria-disabled');
    expect(send()).toHaveClass('button', 'small');
    expect(send()).not.toHaveClass('subtle');
    const line = document.querySelector('.studio-publish__held');
    expect(line).toHaveAttribute('role', 'status');
    expect(line).not.toHaveClass('is-alert');
    // The category and the line are both missing; the category comes first.
    fireEvent.click(send());
    expect(onPublish).not.toHaveBeenCalled();
    // A press that cannot send records nothing.
    expect(take.asked).toBe(0);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'plus.category.nature' }),
    );
    expect(part('category')).toHaveClass('is-called');
    expect(scrolled).toHaveBeenCalledTimes(1);
    // Now that the member has acted, the list wears the alert's colours.
    expect(line).toHaveClass('is-alert');
    // Not the line yet: nothing is red before its turn.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('goes to the name form first while the account has no name', () => {
    identity.missing = true;
    open();
    expect(
      document.querySelectorAll('.studio-publish__held-link')[0],
    ).toHaveTextContent('studio.publish.missing.name');
    fireEvent.click(send());
    expect(part('name')).toHaveClass('is-called');
    expect(part('name')?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.tagName).toBe('INPUT');
  });

  // The clip is the press's own (Ivan, 2026-11-23): never listed as
  // missing, recorded once nothing else is, and sent with the scene.
  it('records the clip and sends with it once nothing is missing', async () => {
    const onPublish = jest.fn();
    open({ suggestedNotes: EVERY_LANGUAGE }, onPublish);
    fireEvent.click(
      screen.getByRole('button', { name: 'plus.category.water' }),
    );
    await act(async () => undefined);
    expect(document.querySelector('.studio-publish__held')).toBeNull();
    expect(take.asked).toBe(0);
    fireEvent.click(send());
    await act(async () => undefined);
    expect(take.asked).toBe(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish.mock.calls[0][3]).toEqual(
      expect.objectContaining({ durationMs: 10000 }),
    );
    expect(scrolled).not.toHaveBeenCalled();
  });
});

describe('while something is under way', () => {
  it('holds Send with its own words while a take is recorded', () => {
    take.phase = 'recording';
    open();
    const held = screen.getByRole('button', {
      name: 'studio.publish.recordingButton',
    });
    expect(held).toBeDisabled();
    // The clip it is making is said on Send, not listed as missing.
    expect(
      [...document.querySelectorAll('.studio-publish__held-link')].map(
        (link) => link.textContent,
      ),
    ).not.toContainEqual(expect.stringContaining('missing.video'));
  });

  it('gives Send back, enabled, when nothing is recorded', () => {
    open();
    expect(send()).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'studio.publish.recordingButton' }),
    ).toBeNull();
  });
});

// Ivan, 2026-11-23: "if they don't have notes and they click publish ...
// ask ... you want the AI to write them down?"
describe('a press with no line', () => {
  const ready = () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'plus.category.water' }),
    );
  };

  it('asks whether AI should write it, in the buttons’ place', () => {
    const onPublish = jest.fn();
    const onWriteNote = jest.fn().mockResolvedValue(true);
    open({}, onPublish, onWriteNote);
    ready();
    fireEvent.click(send());
    expect(screen.getByText('studio.publish.askNoteFirst')).toBeInTheDocument();
    // Its two answers stand where Send was; the recommended one is loud and
    // has the focus.
    expect(
      screen.queryByRole('button', { name: 'studio.publish.goReview' }),
    ).toBeNull();
    const focused = document.activeElement;
    expect(focused?.textContent).toContain('studio.publish.noteWriteAi');
    expect(focused?.closest('.dialog-frame__actions')).not.toBeNull();
    expect(focused).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: 'studio.publish.askNoteMine' }),
    ).toHaveClass('subtle');
    expect(take.asked).toBe(0);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('asks the chat on Yes, and sends nothing on its behalf', async () => {
    const onPublish = jest.fn();
    const onWriteNote = jest.fn().mockResolvedValue(true);
    open({}, onPublish, onWriteNote);
    ready();
    fireEvent.click(send());
    const answers = document.querySelector('.dialog-frame__actions');
    const yes = [...(answers?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent?.includes('studio.publish.noteWriteAi'),
    );
    if (!yes) {
      throw new Error('the loud answer is in the actions');
    }
    fireEvent.click(yes);
    await act(async () => undefined);
    expect(onWriteNote).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('studio.publish.askNoteFirst')).toBeNull();
    expect(send()).toBeInTheDocument();
    expect(take.asked).toBe(0);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("goes to the box on I'll write it, and does not ask again", () => {
    const onWriteNote = jest.fn().mockResolvedValue(true);
    open({}, jest.fn(), onWriteNote);
    ready();
    fireEvent.click(send());
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.publish.askNoteMine' }),
    );
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
    expect(part('note')).toHaveClass('is-called');
    fireEvent.click(send());
    expect(screen.queryByText('studio.publish.askNoteFirst')).toBeNull();
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
    expect(onWriteNote).not.toHaveBeenCalled();
  });

  it('goes straight to the box where no chat can write it', () => {
    open();
    ready();
    fireEvent.click(send());
    expect(screen.queryByText('studio.publish.askNoteFirst')).toBeNull();
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
  });

  it('asks only once every other part is there', () => {
    const onWriteNote = jest.fn().mockResolvedValue(true);
    open({}, jest.fn(), onWriteNote);
    fireEvent.click(send());
    // The category first, as before; the question waits its turn.
    expect(screen.queryByText('studio.publish.askNoteFirst')).toBeNull();
    expect(part('category')).toHaveClass('is-called');
  });
});

// Ivan, 2026-11-23: "when the AI is writing the notes and translating them,
// they can still be published".
describe('while the chat writes or translates the line', () => {
  const written = { suggestedNotes: EVERY_LANGUAGE };

  it('holds Send, with what it waits for, from the first second', () => {
    open({ ...written, noteWriting: true });
    const held = screen.getByRole('button', {
      name: 'studio.publish.writingButton',
    });
    expect(held).toBeDisabled();
    fireEvent.click(held);
    expect(take.asked).toBe(0);
  });

  it('keeps a clip that lands while the chat writes, and sends it only on the next press', async () => {
    take.deferred = true;
    const onPublish = jest.fn();
    const { rerender } = render(dialog(written, onPublish));
    fireEvent.click(
      screen.getByRole('button', { name: 'plus.category.water' }),
    );
    fireEvent.click(send());
    expect(take.asked).toBe(1);
    // The chat starts writing during the take.
    rerender(dialog({ ...written, noteWriting: true }, onPublish));
    await act(async () => take.emit?.());
    expect(onPublish).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'studio.publish.writingButton' }),
    ).toBeDisabled();
    // Its reply ends: the member presses, and the kept clip goes at once.
    rerender(dialog({ ...written, noteWriting: false }, onPublish));
    fireEvent.click(send());
    await act(async () => undefined);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(take.asked).toBe(1);
  });

  it('holds the line itself while the press records', () => {
    take.deferred = true;
    open(written);
    fireEvent.click(
      screen.getByRole('button', { name: 'plus.category.water' }),
    );
    fireEvent.click(send());
    expect(screen.getAllByRole('textbox')[0]).toBeDisabled();
  });

  // Stop waiting ended every later wait too, so a second Write with AI left
  // Send free while the chat wrote.
  it('waits again for a new reply after the member stopped waiting once', () => {
    const { rerender } = render(dialog({ ...written, noteWriting: true }));
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.publish.noteStopWaiting' }),
    );
    expect(send()).toBeEnabled();
    rerender(dialog({ ...written, noteWriting: false }));
    rerender(dialog({ ...written, noteWriting: true }));
    expect(
      screen.getByRole('button', { name: 'studio.publish.writingButton' }),
    ).toBeDisabled();
  });
});

describe('the parts the footer names', () => {
  it('each go to their own part', () => {
    open();
    const [category, note] = document.querySelectorAll<HTMLButtonElement>(
      '.studio-publish__held-link',
    );
    fireEvent.click(note);
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
    expect(part('note')).toHaveClass('is-called');
    // The line is called by name, so it says what it needs now.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.publish.needNoteFirst',
    );
    fireEvent.click(category);
    expect(part('category')).toHaveClass('is-called');
    // The focus left the line, and its outline went with it.
    expect(part('note')).not.toHaveClass('is-called');
  });

  it('lose their outline when its own animation ends, not a child’s', () => {
    open();
    fireEvent.click(send());
    const category = part('category');
    const chip = screen.getByRole('button', { name: 'plus.category.nature' });
    const childEnd = createEvent.animationEnd(chip);
    fireEvent(chip, childEnd);
    expect(category).toHaveClass('is-called');
    if (category) {
      fireEvent.animationEnd(category);
    }
    expect(category).not.toHaveClass('is-called');
  });
});

describe('the preview clip’s watermark', () => {
  it('names FluidEQ, never Plus, in every language', async () => {
    const codes = LOCALES.map((entry) => entry.code);
    await Promise.all(codes.map((code) => loadLocale(code)));
    codes.forEach((code) => {
      const mark = translate(code, 'studio.publish.videoWatermark');
      expect(mark.startsWith('FluidEQ · ')).toBe(true);
      expect(mark).not.toMatch(/plus/i);
    });
    expect(translate('en', 'studio.publish.videoWatermark')).toBe(
      'FluidEQ · Preview',
    );
  });
});
