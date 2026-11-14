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
// Whether the camera says a take is being recorded.
const take = { recording: false };
jest.mock('../../../renderer/plus/profileStore', () => ({
  usePublicIdentity: () => identity,
  createProfile: jest.fn(() => Promise.resolve(true)),
  useProfile: () => ({ saving: false, error: undefined }),
  clearProfileError: jest.fn(),
}));
// A camera whose clip is ready, inside a video section like the real one's.
jest.mock('../../../renderer/studio/StudioPublishCamera', () => {
  const { useLayoutEffect } =
    jest.requireActual<typeof import('react')>('react');
  return function Camera({
    source,
    onPreview,
    onRecording,
  }: {
    source: string;
    onPreview: (value: unknown) => void;
    onRecording?: (recording: boolean) => void;
  }) {
    useLayoutEffect(() => {
      onRecording?.(take.recording);
      if (take.recording) {
        return;
      }
      onPreview({
        source,
        blob: new Blob(['clip']),
        durationMs: 10000,
        width: 640,
        height: 360,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- one clip per mount
    }, []);
    return (
      <section data-publish-part="video">
        <button type="button">record</button>
      </section>
    );
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

const open = (more: Partial<IPublishDraft> = {}, onPublish = jest.fn()) =>
  render(
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
      onCancel={jest.fn()}
    />,
  );

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
  take.recording = false;
});

describe('a press while a part is missing', () => {
  it('goes to the first missing part, focuses it and outlines it, and sends nothing', () => {
    const onPublish = jest.fn();
    open({}, onPublish);
    // Ivan, 2026-11-14: "enable the button, so when they click they can tell
    // which is the error". Never dead, and the list quiet until a press.
    expect(send()).toBeEnabled();
    const line = document.querySelector('.studio-publish__held');
    expect(line).toHaveAttribute('role', 'status');
    expect(line).not.toHaveClass('is-alert');
    // The category and the line are both missing; the category comes first.
    fireEvent.click(send());
    expect(onPublish).not.toHaveBeenCalled();
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

  it('sends once nothing is missing', async () => {
    const onPublish = jest.fn();
    open({ suggestedNotes: EVERY_LANGUAGE }, onPublish);
    fireEvent.click(
      screen.getByRole('button', { name: 'plus.category.water' }),
    );
    await act(async () => undefined);
    expect(document.querySelector('.studio-publish__held')).toBeNull();
    fireEvent.click(send());
    await act(async () => undefined);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(scrolled).not.toHaveBeenCalled();
  });
});

describe('while something is under way', () => {
  it('holds Send with its own words while a take is recorded', () => {
    take.recording = true;
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
