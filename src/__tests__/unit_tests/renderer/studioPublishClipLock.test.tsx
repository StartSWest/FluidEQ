/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The preview clip is recorded before Publish is pressed and never again
 * while the publication runs (Ivan, 2026-11-09: "is allowing me to re record
 * the demo until is not publised ... we alow it only once per before
 * plublising"). Publishing writes the version it goes out under into the
 * project, which builds again: a new pack, which used to start a new
 * recording mid-publish.
 */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import {
  resetAccountStore,
  subscribeAccount,
} from '../../../renderer/account/accountStore';
import { resetRendererAddons } from '../../../renderer/addons';
import StudioPublishDialog from '../../../renderer/studio/StudioPublishDialog';
import StudioPublishVideo from '../../../renderer/studio/StudioPublishVideo';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';

/** Every time the camera starts, and the pack it was handed: a recording. */
const takes: { source: string; packVersion: number }[] = [];
const shown: number[] = [];

jest.mock('../../../renderer/studio/StudioPublishCamera', () => {
  const { useLayoutEffect } =
    jest.requireActual<typeof import('react')>('react');
  return function Camera({
    source,
    pack,
    onPreview,
  }: {
    source: string;
    pack: IScenePack;
    onPreview: (value: unknown) => void;
  }) {
    // Once per mount: the camera is keyed on its source, so a new mount is
    // a new recording.
    useLayoutEffect(() => {
      takes.push({ source, packVersion: pack.version });
      onPreview({
        source,
        blob: new Blob(['clip']),
        durationMs: 10000,
        width: 640,
        height: 360,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount is the point: a mount is a take
    }, []);
    shown.push(pack.version);
    return null;
  };
});

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const CITY = '11111111-1111-4111-8111-111111111111';

const packAt = (version: number): IScenePack => ({
  schema: 1,
  id: 'neon-city',
  version,
  contract: 1,
  names: { en: 'Neon City' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  source: '',
  params: [],
});

const draft: IPublishDraft = {
  shots: [
    {
      id: 1,
      kind: 'auto',
      picture: {
        bytes: new Uint8Array(8),
        url: 'data:image/webp;base64,UklGRg==',
      },
    },
  ],
  chosen: 1,
  missed: false,
  agreed: true,
  held: 3,
};

const dialog = (pack: IScenePack, running: boolean) => (
  <StudioPublishDialog
    name="Neon City"
    identity={CITY}
    pack={pack}
    tuning={{}}
    onCapture={jest.fn()}
    onChoose={jest.fn()}
    draft={draft}
    running={running}
    onPublish={jest.fn()}
    onCancel={jest.fn()}
  />
);

beforeEach(async () => {
  takes.length = 0;
  shown.length = 0;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        getAccountState: jest.fn().mockResolvedValue({ status: 'signed-out' }),
        onAccountState: jest.fn(() => () => {}),
      },
    },
  });
  subscribeAccount(() => undefined);
  await act(async () => undefined);
});

afterEach(() => {
  resetAccountStore();
  resetRendererAddons();
});

describe("the publish dialog's clip", () => {
  it('is recorded again for a changed scene before Publish is pressed', () => {
    // The control: an edit before the press is a new clip, as it always was.
    const { rerender } = render(dialog(packAt(3), false));
    rerender(dialog(packAt(4), false));
    expect(takes.map((take) => take.packVersion)).toEqual([3, 4]);
  });

  it('is never recorded again while the publication runs, whatever the project does', () => {
    const { rerender } = render(dialog(packAt(3), false));
    rerender(dialog(packAt(3), true));
    // Publishing writes the version into pack.json; the project builds again.
    rerender(dialog(packAt(4), true));
    rerender(dialog(packAt(4), true));
    expect(takes).toHaveLength(1);
    // And the camera goes on showing the scene the clip is of.
    expect(shown[shown.length - 1]).toBe(3);
  });

  it('is recorded again for the retry once a publication has failed', () => {
    const { rerender } = render(dialog(packAt(3), false));
    rerender(dialog(packAt(3), true));
    rerender(dialog(packAt(4), true));
    rerender(dialog(packAt(4), false));
    expect(takes.map((take) => take.packVersion)).toEqual([3, 4]);
  });
});

describe("the clip's own buttons while it is published", () => {
  const ready = {
    phase: 'ready' as const,
    url: 'blob:clip',
    video: {
      source: 'clip',
      blob: new Blob(['clip']),
      durationMs: 10000,
      width: 640,
      height: 360,
    },
  };

  it('are held and say why, and are free before the press', () => {
    const { rerender } = render(
      <StudioPublishVideo
        state={ready}
        locked
        onCancel={jest.fn()}
        onRetry={jest.fn()}
      />,
    );
    const again = screen.getByRole('button', {
      name: 'studio.publish.videoAgain',
    });
    expect(again).toBeDisabled();
    expect(again).toHaveAttribute('title', 'studio.publish.clipLocked');
    rerender(
      <StudioPublishVideo
        state={ready}
        locked={false}
        onCancel={jest.fn()}
        onRetry={jest.fn()}
      />,
    );
    expect(again).toBeEnabled();
    expect(again).not.toHaveAttribute('title');
  });
});
