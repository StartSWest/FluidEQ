/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { translate } from 'common/i18n';
import { memberLookId } from 'common/memberScenes';
import { FLUIDEQ_CREATOR_ID, type IGalleryScene } from 'common/plusGallery';
import { lockedLookId } from 'common/scenePacks';
import LookPickerBody from 'renderer/graph/LookPickerBody';
import type { TPickerView } from 'renderer/graph/lookPickerFilter';
import { buildPlusRows, type IPlusRow } from 'renderer/graph/lookPickerRows';
import { openGalleryPage } from 'renderer/plus/plusNavigation';
import { requestPlusTab } from 'renderer/plus/plusTabRequest';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { markSceneVersionSeen } from 'renderer/utils/seenSceneVersions';
import type {
  ILockedMemberScene,
  IUsableMemberScene,
} from 'renderer/utils/memberScenes';
import type { IUsableScene } from 'renderer/utils/scenePacks';

/**
 * Ivan, 2026-11-25, of a member scene's "by Prime" in the look picker: "if I
 * click the user it should take me to the gallery with that user filter, to
 * see that user's scenes". The maker's words lead to their gallery page,
 * FluidEQ's own included, and never play the scene they stand under.
 */

jest.mock('renderer/plus/plusNavigation', () => ({
  ...jest.requireActual('renderer/plus/plusNavigation'),
  openGalleryPage: jest.fn(),
}));
jest.mock('renderer/plus/plusTabRequest', () => ({
  requestPlusTab: jest.fn(),
}));
// The column's last line counts the gallery's newest page, which loads
// after these synchronous cases end; `lookPickerMore.test.tsx` holds it.
jest.mock('renderer/plus/galleryStore', () => ({
  ...jest.requireActual<object>('renderer/plus/galleryStore'),
  useGalleryList: () => ({ list: { scenes: [] } }),
}));

const PRIME = '40000000-0000-4000-8000-0000000000bb';
const ME = 'faaed582-d6f4-4e70-999b-86e8518a7dc4';
const FLUIDEQ_PAGE = {
  authorId: FLUIDEQ_CREATOR_ID,
  name: 'FluidEQ',
  handle: 'fluideq',
};

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate('en', key, vars);

const official = {
  id: 'alpine',
  lookId: 'premium:alpine',
  version: 3,
  names: { en: 'Alpine' },
  swatch: ['#000000', '#ffffff'],
} as unknown as IUsableScene;

const member = (authorId: string, packId: string, own: boolean) =>
  ({
    kind: 'member',
    lookId: memberLookId(authorId, packId),
    authorId,
    packId,
    version: 2,
    names: { en: packId },
    swatch: ['#000000', '#ffffff'],
    own,
    ...(own ? {} : { authorName: 'Prime' }),
  }) as unknown as IUsableMemberScene;

const rowsOf = (
  members: IUsableMemberScene[],
  lockedMembers: ILockedMemberScene[] = [],
  findInGallery: (lookId: string) => IGalleryScene | undefined = () =>
    undefined,
) =>
  buildPlusRows({
    usable: [official],
    locked: [],
    members,
    lockedMembers,
    locale: 'en',
    t,
    findInGallery,
  });

beforeEach(() => {
  jest.mocked(openGalleryPage).mockClear();
  jest.mocked(requestPlusTab).mockClear();
});

describe('which page a scene’s maker leads to', () => {
  it('is FluidEQ’s for its own, the member’s for theirs, none for one’s own', () => {
    const [alpine, mine, prism] = rowsOf([
      member(ME, 'my-own', true),
      member(PRIME, 'prism', false),
    ]);
    expect(alpine.makerPage).toEqual(FLUIDEQ_PAGE);
    expect(mine.makerPage).toBeUndefined();
    expect(prism.makerPage).toEqual({
      authorId: PRIME,
      name: 'Prime',
      handle: null,
    });
  });

  it('names the member as the gallery does, once it has seen the scene', () => {
    const scene = member(PRIME, 'prism', false);
    const [, prism] = rowsOf([scene], [], (lookId) =>
      lookId === scene.lookId
        ? ({
            authorId: PRIME,
            authorName: 'Prime Time',
            authorHandle: 'prime',
          } as unknown as IGalleryScene)
        : undefined,
    );
    expect(prism.makerPage).toEqual({
      authorId: PRIME,
      name: 'Prime Time',
      handle: 'prime',
    });
  });

  it('still finds the maker of a scene locked with the membership', () => {
    const locked: ILockedMemberScene = {
      lookId: lockedLookId(memberLookId(PRIME, 'prism')),
      names: { en: 'Prism' },
      swatch: ['#000000'],
      own: false,
      authorName: 'Prime',
    };
    const [, prism] = rowsOf([], [locked]);
    expect(prism.makerPage?.authorId).toBe(PRIME);
  });
});

const open = (
  rows: readonly IPlusRow[],
  view: TPickerView,
  onLeave: (() => void) | undefined,
) => {
  const onChoose = jest.fn();
  render(
    <I18nProvider>
      <LookPickerBody
        value=""
        styleRows={[]}
        plusRows={rows}
        query=""
        place="all-scenes"
        from="all"
        sort="newest"
        view={view}
        onQuery={jest.fn()}
        onPlace={jest.fn()}
        onFrom={jest.fn()}
        onSort={jest.fn()}
        onView={jest.fn()}
        onChoose={onChoose}
        searchRef={createRef<HTMLInputElement>()}
        onLeave={onLeave}
      />
    </I18nProvider>,
  );
  return onChoose;
};

it('leaves a tile’s line plain while it carries a new version’s note instead of its maker', () => {
  // Its own scene: the version marked as seen stays for the file.
  const [, glass] = rowsOf([member(PRIME, 'glass', false)]);
  markSceneVersionSeen(glass.id, 1);
  open([glass], 'grid', jest.fn());
  expect(
    screen.queryByRole('button', {
      name: t('graph.picker.seeMaker', { name: 'Prime' }),
    }),
  ).toBeNull();
  expect(
    screen.getByText(t('graph.version.captionBare', { version: '2' })),
  ).toBeInTheDocument();
});

describe.each<TPickerView>(['grid', 'details'])('in the %s view', (view) => {
  const rows = rowsOf([member(PRIME, 'prism', false)]);

  it('opens the member’s gallery page from “by Prime”, leaving, never picking', () => {
    const onLeave = jest.fn();
    const onChoose = open(rows, view, onLeave);
    const by = screen.getByRole('button', {
      name: t('graph.picker.seeMaker', { name: 'Prime' }),
    });
    expect(by).toHaveTextContent(t('graph.member.by', { name: 'Prime' }));
    fireEvent.click(by);
    expect(openGalleryPage).toHaveBeenCalledWith({
      kind: 'maker',
      maker: { authorId: PRIME, name: 'Prime', handle: null },
    });
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(requestPlusTab).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('opens FluidEQ’s gallery page from one of FluidEQ’s scenes', () => {
    open(rows, view, jest.fn());
    fireEvent.click(
      screen.getByRole('button', {
        name: t('graph.picker.seeMaker', { name: 'FluidEQ' }),
      }),
    );
    expect(openGalleryPage).toHaveBeenCalledWith({
      kind: 'maker',
      maker: FLUIDEQ_PAGE,
    });
  });

  it('stays plain words where the picker cannot be left (Help’s drawing)', () => {
    open(rows, view, undefined);
    expect(
      screen.queryByRole('button', {
        name: t('graph.picker.seeMaker', { name: 'Prime' }),
      }),
    ).toBeNull();
    expect(
      screen.getByText(t('graph.member.by', { name: 'Prime' })),
    ).toBeInTheDocument();
  });
});
