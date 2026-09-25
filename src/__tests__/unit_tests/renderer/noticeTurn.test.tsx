/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which notice is on screen when several want it, held to the order the
 * stylesheets used to encode with `body:has(...) { display: none }` rules.
 *
 * The pairs below are those rules, written out by hand from the stylesheets
 * as they stood (SceneReviewNotice.scss, PlusTermsNotice.scss,
 * EngineUpdateNotice.scss, EngineTroubleNotice.scss) rather than read from
 * the store, so a change to the store's table is a change this has to be
 * told about.
 */

import '@testing-library/jest-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  claimNotice,
  noticeMayShow,
  useNoticeClaim,
  useNoticeTurn,
  type TNoticeClaim,
} from 'renderer/utils/noticeTurn';
import useAppFullMark, {
  APP_FULL_ATTRIBUTE,
} from 'renderer/utils/useAppFullMark';

type TNotice = Exclude<TNoticeClaim, 'modal' | 'appFull'>;

const NOTICES: readonly TNotice[] = [
  'output',
  'room',
  'engineTrouble',
  'engineUpdate',
  'audioRestart',
  'prereq',
  'songEq',
  'plusTerms',
  'sceneReview',
  'makerMonth',
];

/** Everything that can hold a notice back: the notices, a dialog, full screen. */
const HOLDERS: readonly TNoticeClaim[] = [...NOTICES, 'modal', 'appFull'];

/**
 * `[loser, winner]`: the loser is not on screen while the winner wants it.
 *
 * `.scene-review-notice` is on both the review news and the maker's month,
 * `.device-apo-notice` on the output notice, the Room's offer and both engine
 * notices; `[aria-modal='true']` is `modal`, `.app-workspace.is-app-full`
 * is `appFull`.
 */
const CORNER_GIVES_WAY_TO: readonly TNoticeClaim[] = [
  'modal',
  'output',
  'room',
  'engineTrouble',
  'engineUpdate',
  'audioRestart',
  'prereq',
  'songEq',
  'appFull',
];
const CSS_ENCODED: readonly (readonly [TNotice, TNoticeClaim])[] = [
  // SceneReviewNotice.scss, first rule: `.plus-terms-notice` and everything
  // the terms notice steps aside for hide `.scene-review-notice`.
  ...(['sceneReview', 'makerMonth'] as const).flatMap((loser) =>
    [...CORNER_GIVES_WAY_TO, 'plusTerms' as const].map(
      (winner) => [loser, winner] as const,
    ),
  ),
  // SceneReviewNotice.scss, second rule.
  ['makerMonth', 'sceneReview'],
  // PlusTermsNotice.scss.
  ...CORNER_GIVES_WAY_TO.map((winner) => ['plusTerms', winner] as const),
  // EngineUpdateNotice.scss: `.device-apo-notice:not(.engine-update-notice)`.
  ['engineUpdate', 'output'],
  ['engineUpdate', 'room'],
  ['engineUpdate', 'engineTrouble'],
  // EngineTroubleNotice.scss:
  // `.device-apo-notice:not(.engine-trouble-notice):not(.engine-update-notice)`.
  ['engineTrouble', 'output'],
  ['engineTrouble', 'room'],
];

const isEncoded = (loser: TNotice, winner: TNoticeClaim) =>
  CSS_ENCODED.some(([a, b]) => a === loser && b === winner);

const Probe = ({ notice }: { notice: TNotice }) =>
  useNoticeTurn(notice, true) ? <div data-testid={notice} /> : null;

const FullScreen = ({ isFull }: { isFull: boolean }) => {
  useAppFullMark(isFull);
  return null;
};

/** Whatever `holder` is, wanting the screen. */
const Holder = ({ holder }: { holder: TNoticeClaim }) => {
  if (holder === 'modal') {
    return <div role="dialog" aria-modal="true" />;
  }
  if (holder === 'appFull') {
    return <FullScreen isFull />;
  }
  return <Probe notice={holder} />;
};

/** Lets the dialog watch's mutation callback run, and React answer it. */
const settle = () => act(async () => {});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('the order the stylesheets encoded', () => {
  // Every notice against every other thing that can want the screen: hidden
  // exactly where a rule said so, and shown everywhere else.
  it.each(
    NOTICES.flatMap((loser) =>
      HOLDERS.filter((holder) => holder !== loser).map(
        (holder) => [loser, holder] as const,
      ),
    ),
  )('%s beside %s', async (loser, holder) => {
    render(
      <>
        <Probe notice={loser} />
        <Holder holder={holder} />
      </>,
    );
    await settle();
    expect(screen.queryByTestId(loser) !== null).toBe(
      !isEncoded(loser, holder),
    );
  });

  it('shows every notice that has the screen to itself', () => {
    render(
      <>
        {NOTICES.map((notice) => (
          <div key={notice}>
            <Probe notice={notice} />
          </div>
        ))}
      </>,
    );
    // Positive control for the pairs above: with everything wanting the
    // screen, exactly the ones nothing hides are drawn.
    const shown = NOTICES.filter(
      (notice) => screen.queryByTestId(notice) !== null,
    );
    expect(shown).toEqual([
      'output',
      'room',
      'audioRestart',
      'prereq',
      'songEq',
    ]);
    cleanup();
    NOTICES.forEach((notice) => {
      render(<Probe notice={notice} />);
      expect(screen.getByTestId(notice)).toBeInTheDocument();
      cleanup();
    });
  });

  it('agrees with the pure answer the hook is built on', () => {
    NOTICES.forEach((loser) =>
      HOLDERS.forEach((holder) => {
        expect(noticeMayShow(loser, new Set([holder]))).toBe(
          holder === loser || !isEncoded(loser, holder),
        );
      }),
    );
  });

  // A notice held back by something still holds back the ones below it, as
  // an element under `display: none` still matched the rules' `:has()`.
  it('lets a waiting notice keep the ones below it waiting', () => {
    const releaseOutput = claimNotice('output');
    render(
      <>
        <Probe notice="plusTerms" />
        <Probe notice="sceneReview" />
        <Probe notice="makerMonth" />
      </>,
    );
    expect(screen.queryByTestId('plusTerms')).toBeNull();
    expect(screen.queryByTestId('sceneReview')).toBeNull();

    act(releaseOutput);
    expect(screen.getByTestId('plusTerms')).toBeInTheDocument();
    expect(screen.queryByTestId('sceneReview')).toBeNull();
    expect(screen.queryByTestId('makerMonth')).toBeNull();
  });

  it('gives the corner back the moment the notice in front is put away', () => {
    const Scene = ({ termsWanted }: { termsWanted: boolean }) => {
      useNoticeClaim('plusTerms', termsWanted);
      return <Probe notice="sceneReview" />;
    };
    const { rerender } = render(<Scene termsWanted />);
    expect(screen.queryByTestId('sceneReview')).toBeNull();
    rerender(<Scene termsWanted={false} />);
    expect(screen.getByTestId('sceneReview')).toBeInTheDocument();
  });

  it('counts two claims of one kind, as two restart notices can be up', () => {
    const first = claimNotice('audioRestart');
    const second = claimNotice('audioRestart');
    render(<Probe notice="plusTerms" />);
    act(first);
    // Releasing the same claim twice does not release the other one.
    act(first);
    expect(screen.queryByTestId('plusTerms')).toBeNull();
    act(second);
    expect(screen.getByTestId('plusTerms')).toBeInTheDocument();
  });
});

describe('dialogs', () => {
  it('hides the corner while one is in the document, wherever it is', async () => {
    render(<Probe notice="sceneReview" />);
    expect(screen.getByTestId('sceneReview')).toBeInTheDocument();

    // Deep in a subtree added at once, as a dialog rendered in place is.
    const host = document.createElement('section');
    host.innerHTML = '<div><div role="dialog" aria-modal="true"></div></div>';
    document.body.appendChild(host);
    await settle();
    expect(screen.queryByTestId('sceneReview')).toBeNull();

    host.remove();
    await settle();
    expect(screen.getByTestId('sceneReview')).toBeInTheDocument();
  });

  it('follows aria-modal itself, and only its true value', async () => {
    const dialog = document.createElement('div');
    document.body.appendChild(dialog);
    render(<Probe notice="plusTerms" />);

    dialog.setAttribute('aria-modal', 'true');
    await settle();
    expect(screen.queryByTestId('plusTerms')).toBeNull();

    dialog.setAttribute('aria-modal', 'false');
    await settle();
    expect(screen.getByTestId('plusTerms')).toBeInTheDocument();
  });

  it('pays no attention to anything else coming and going', async () => {
    render(<Probe notice="makerMonth" />);
    const row = document.createElement('div');
    row.innerHTML = '<span role="row"><button type="button">x</button></span>';
    document.body.appendChild(row);
    await settle();
    expect(screen.getByTestId('makerMonth')).toBeInTheDocument();
    row.remove();
  });

  it('sees a dialog that was already up when the notice arrived', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    render(<Probe notice="plusTerms" />);
    expect(screen.queryByTestId('plusTerms')).toBeNull();
  });

  it('leaves the engine spot alone', async () => {
    render(
      <>
        <Probe notice="engineTrouble" />
        <div role="dialog" aria-modal="true" />
      </>,
    );
    await settle();
    expect(screen.getByTestId('engineTrouble')).toBeInTheDocument();
  });
});

describe('full screen', () => {
  it('marks the document and hides the corner for as long as it lasts', () => {
    const Both = ({ isFull }: { isFull: boolean }) => (
      <>
        <FullScreen isFull={isFull} />
        <Probe notice="plusTerms" />
      </>
    );
    const { rerender, unmount } = render(<Both isFull={false} />);
    expect(document.documentElement).not.toHaveAttribute(APP_FULL_ATTRIBUTE);
    expect(screen.getByTestId('plusTerms')).toBeInTheDocument();

    rerender(<Both isFull />);
    expect(document.documentElement).toHaveAttribute(APP_FULL_ATTRIBUTE);
    expect(screen.queryByTestId('plusTerms')).toBeNull();

    rerender(<Both isFull={false} />);
    expect(document.documentElement).not.toHaveAttribute(APP_FULL_ATTRIBUTE);
    expect(screen.getByTestId('plusTerms')).toBeInTheDocument();

    rerender(<Both isFull />);
    unmount();
    // Nothing left behind by a shell that went away while full screen.
    expect(document.documentElement).not.toHaveAttribute(APP_FULL_ATTRIBUTE);
  });
});
