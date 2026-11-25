/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The line beside the project in the Studio's bar (Ivan, 2026-11-25: "I
 * don't know whether the thing is new or is changes"): one sentence for
 * where the scene stands — the gallery's version and the bench's — the
 * review's word, the copy in the looks, and the stage only when it has news.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TSceneStanding } from '../../../common/sceneReviewStanding';
import { studioBenchStatus } from '../../../renderer/studio/studioBenchStatus';
import StudioVersionLine from '../../../renderer/studio/StudioVersionLine';
import {
  studioVersionLine,
  type TGalleryAnswer,
} from '../../../renderer/studio/versionLine';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length > 0
        ? `${key} ${JSON.stringify(vars)}`
        : key,
  }),
}));

const LIVE = (version: number): TGalleryAnswer => ({ state: 'live', version });
const record = (version: number, unchanged: boolean) => ({
  sceneId: 'aurora',
  version,
  unchanged,
});
const pending = (version: number): TSceneStanding => ({
  kind: 'pending',
  version,
  submittedAt: '2026-11-24T10:00:00Z',
});
const refused = (version: number): TSceneStanding => ({
  kind: 'rejected',
  version,
  reason: 'flashing',
  decidedAt: '2026-11-24T12:00:00Z',
});

type TInput = Parameters<typeof studioVersionLine>[0];
const base: TInput = {
  version: 21,
  gallery: LIVE(21),
  record: record(21, true),
  standing: undefined,
  inspecting: false,
};

describe('the sentence for every state the bar can be in', () => {
  // [what the member is in, the facts, key, vars, mark, See why, loud Publish]
  const TABLE: [
    string,
    Partial<TInput>,
    string,
    Record<string, number>,
    string,
    boolean,
    boolean,
  ][] = [
    [
      'never published',
      { version: 1, gallery: { state: 'none' }, record: undefined },
      'studio.line.unpublished',
      {},
      'off',
      false,
      false,
    ],
    [
      'published, nothing changed since',
      {},
      'studio.line.same',
      { version: 21 },
      'live',
      false,
      false,
    ],
    [
      'changed since it was published',
      { record: record(21, false) },
      'studio.line.changed',
      { version: 21 },
      'changed',
      false,
      true,
    ],
    [
      'a newer version waiting for review',
      { version: 22, record: record(22, true), standing: pending(22) },
      'studio.line.review',
      { version: 22, live: 21 },
      'review',
      false,
      false,
    ],
    [
      'the first version waiting for review',
      {
        version: 1,
        gallery: { state: 'none' },
        record: record(1, true),
        standing: pending(1),
      },
      'studio.line.firstReview',
      { version: 1 },
      'review',
      false,
      false,
    ],
    [
      'a newer version refused',
      { version: 22, record: record(22, false), standing: refused(22) },
      'studio.line.rejected',
      { version: 22, live: 21 },
      'refused',
      true,
      false,
    ],
    [
      'the first version refused',
      {
        version: 1,
        gallery: { state: 'none' },
        record: record(1, true),
        standing: refused(1),
      },
      'studio.line.firstRejected',
      { version: 1 },
      'refused',
      true,
      false,
    ],
    [
      'published from another computer',
      { record: undefined },
      'studio.line.elsewhere',
      { version: 21 },
      'live',
      false,
      false,
    ],
    [
      'published later from another computer than this one did',
      { record: record(19, false) },
      'studio.line.elsewhere',
      { version: 21 },
      'live',
      false,
      false,
    ],
    [
      'a newer version sent from here that the review has not answered',
      { version: 22, record: record(22, true) },
      'studio.line.inGallery',
      { version: 21 },
      'live',
      false,
      false,
    ],
    [
      'signed out or offline',
      { gallery: { state: 'unknown' }, record: record(21, false) },
      'studio.line.unknown',
      {},
      'off',
      false,
      false,
    ],
    [
      'a scene opened to look inside',
      { inspecting: true, gallery: { state: 'unknown' }, record: undefined },
      'studio.line.inspect',
      { version: 21 },
      'none',
      false,
      false,
    ],
  ];

  it.each(TABLE)(
    '%s',
    (_state, facts, key, vars, mark, seeWhy, publishSuggested) => {
      expect(studioVersionLine({ ...base, ...facts })).toEqual({
        key,
        vars,
        mark,
        seeWhy,
        publishSuggested,
      });
    },
  );

  it('says nothing at all while the gallery is still being asked', () => {
    expect(studioVersionLine({ ...base, gallery: { state: 'asking' } })).toBe(
      'asking',
    );
  });

  it('never calls a scene unpublished when the gallery could not be asked', () => {
    // The old chip said "It has not been published" offline. Every fact that
    // would make the line say so is given here except the gallery's answer.
    const offline = studioVersionLine({
      ...base,
      version: 21,
      gallery: { state: 'unknown' },
      record: undefined,
    });
    expect(offline).not.toBe('asking');
    expect(offline).toMatchObject({ key: 'studio.line.unknown' });
    // POSITIVE CONTROL: the same facts with the gallery saying "none" do.
    expect(
      studioVersionLine({
        ...base,
        gallery: { state: 'none' },
        record: undefined,
      }),
    ).toMatchObject({ key: 'studio.line.unpublished' });
  });

  it('ignores a review word about a version the gallery has already passed', () => {
    expect(studioVersionLine({ ...base, standing: refused(20) })).toMatchObject(
      { key: 'studio.line.same', seeWhy: false },
    );
  });
});

describe('the stage line', () => {
  const facts = {
    chatBusy: false,
    hasPack: true,
    hasProblems: false,
  };

  it('says nothing while the stage plays the last save', () => {
    expect(studioBenchStatus(facts)).toBeUndefined();
  });

  it('speaks when it has news', () => {
    expect(studioBenchStatus({ ...facts, chatBusy: true })).toBe(
      'studioChat.status.working',
    );
    expect(studioBenchStatus({ ...facts, hasProblems: true })).toBe(
      'studio.status.problem',
    );
    expect(studioBenchStatus({ ...facts, hasPack: false })).toBe(
      'studio.status.waiting',
    );
  });
});

describe('the line in the bar', () => {
  const sentence = (facts: Partial<TInput> = {}) =>
    studioVersionLine({ ...base, ...facts });

  it('says where the scene stands with its mark, and no stage line while all is well', () => {
    const { container } = render(
      <StudioVersionLine
        line={sentence({ record: record(21, false) })}
        standing={undefined}
        look={undefined}
        stage={undefined}
      />,
    );
    const group = screen.getByRole('group', { name: 'studio.version.group' });
    expect(group).toHaveTextContent('studio.line.changed {"version":21}');
    expect(container.querySelector('.studio-line__dot')).toHaveClass(
      'is-changed',
    );
    expect(container.querySelector('.studio-bench__status')).toBeNull();
    // No Publish of its own: the bar's Publish button is the one control.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps its room while the gallery is asked, with no words in it', () => {
    const { container } = render(
      <StudioVersionLine
        line="asking"
        standing={undefined}
        look={undefined}
        stage={undefined}
      />,
    );
    const held = container.querySelector('.studio-line__say');
    expect(held).toHaveClass('is-asking');
    expect(held).toBeEmptyDOMElement();
  });

  it('says the stage only when it has news, beside the sentence', () => {
    const { container } = render(
      <StudioVersionLine
        line={sentence()}
        standing={undefined}
        look={undefined}
        stage="studio.status.problem"
      />,
    );
    expect(container.querySelector('.studio-bench__status')).toHaveClass(
      'is-problem',
    );
    expect(screen.getByText('studio.status.problem')).toBeInTheDocument();
  });

  it('says whether the looks have this scene or an older copy', () => {
    const { rerender } = render(
      <StudioVersionLine
        line={sentence()}
        standing={undefined}
        look={{ version: 21, current: true }}
        stage={undefined}
      />,
    );
    const looks = screen.getByText('studio.line.inLooks');
    expect(looks).toHaveAttribute(
      'title',
      'studio.version.looksCurrent {"version":21}',
    );
    expect(screen.queryByText('studio.line.looksOlder')).toBeNull();
    rerender(
      <StudioVersionLine
        line={sentence()}
        standing={undefined}
        look={{ version: 21, current: false }}
        stage={undefined}
      />,
    );
    expect(screen.getByText('studio.line.looksOlder')).toHaveAttribute(
      'title',
      'studio.version.looksBehind {"version":21}',
    );
    expect(screen.queryByText('studio.line.inLooks')).toBeNull();
  });

  it('opens the review’s reason from See why after a refusal, and offers it for nothing else', async () => {
    const standing = refused(22);
    const { rerender } = render(
      <StudioVersionLine
        line={sentence({ version: 22, record: record(22, true), standing })}
        standing={standing}
        look={undefined}
        stage={undefined}
      />,
    );
    const why = screen.getByRole('button', { name: 'studio.line.seeWhy' });
    expect(why).toHaveClass('link-button');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.pointerEnter(why);
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'review.reason.flashing',
    );
    fireEvent.pointerLeave(why);
    await userEvent.click(why);
    fireEvent.pointerLeave(why);
    act(() => why.blur());
    // A press keeps it open to be read.
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The control: a version waiting for review has no See why.
    rerender(
      <StudioVersionLine
        line={sentence({
          version: 22,
          record: record(22, true),
          standing: pending(22),
        })}
        standing={pending(22)}
        look={undefined}
        stage={undefined}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'studio.line.seeWhy' }),
    ).toBeNull();
  });
});
