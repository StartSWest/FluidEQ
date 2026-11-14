/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The moves of the coins that celebrate a paid pack (`CoinCelebration`), on
 * the Web Animations API: every step is an animation with its own delay, and
 * the whole is done when the last one is. Nothing waits on a clock, and a
 * skip cancels every animation at once, so nothing is left running after.
 *
 * About two seconds: the coins pop in one after another with a burst and
 * sparks, the "+N credits" line rises under them, and they fly into the
 * balance if it is on screen, or float up and fade if it is not. Turned-down
 * motion is a calm fade of the coins and the line, in and out, nothing moving.
 *
 * No imports: the preview Ivan judged the motion from runs this same module.
 */

export interface ICelebrationParts {
  /** The coins, in reading order; each is laid out where it comes to rest. */
  coins: readonly HTMLElement[];
  /** The ring that bursts out from behind them. */
  burst: HTMLElement;
  /** The glow behind the coins. */
  glow: HTMLElement;
  /** The sparks thrown out by the burst. */
  sparks: readonly HTMLElement[];
  /** "+N credits". */
  line: HTMLElement;
}

export interface ICelebrationOptions {
  /** Motion turned down: fades only. */
  reduced: boolean;
  /** Where the balance stands on screen, for the coins to fly into. */
  target?: DOMRect;
}

export interface ICelebration {
  /** Settles once every animation has ended, by finishing or by a skip. */
  finished: Promise<void>;
  /** Ends it now: every animation cancelled, nothing left drawn by them. */
  skip: () => void;
}

/** When the coins leave for the balance, from the start. */
const LEAVE_AT = 1300;
const POP = 560;
const POP_STAGGER = 95;
const FLY = 620;
const FLY_STAGGER = 80;

const centre = (rect: DOMRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/**
 * Each spark's direction and reach, from its place among the others: an even
 * fan all round, every other one longer, so the burst reads as thrown rather
 * than drawn with a compass. Fixed by position, never random, so the same
 * pack celebrates the same way.
 */
const sparkPath = (index: number, count: number) => {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const reach = index % 2 === 0 ? 118 : 82;
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
};

const calm = (
  parts: ICelebrationParts,
  run: (
    element: Element,
    frames: Keyframe[],
    timing: KeyframeAnimationOptions,
  ) => void,
) => {
  const fade: Keyframe[] = [
    { opacity: 0 },
    { opacity: 1, offset: 0.2 },
    { opacity: 1, offset: 0.78 },
    { opacity: 0 },
  ];
  [...parts.coins, parts.line, parts.glow].forEach((element) =>
    run(element, fade, { duration: 1700, easing: 'ease-in-out', fill: 'both' }),
  );
};

export const playCelebration = (
  parts: ICelebrationParts,
  { reduced, target }: ICelebrationOptions,
): ICelebration => {
  // Where every coin rests, read before anything moves it.
  const rests = parts.coins.map((coin) => centre(coin.getBoundingClientRect()));
  const animations: Animation[] = [];
  const run = (
    element: Element,
    frames: Keyframe[],
    timing: KeyframeAnimationOptions,
  ) => {
    animations.push(element.animate(frames, timing));
  };

  if (reduced) {
    calm(parts, run);
    // The burst and sparks are motion and nothing else: not drawn at all.
    [parts.burst, ...parts.sparks].forEach((element) =>
      run(element, [{ opacity: 0 }, { opacity: 0 }], {
        duration: 1,
        fill: 'both',
      }),
    );
  } else {
    parts.coins.forEach((coin, index) => {
      const delay = index * POP_STAGGER;
      run(
        coin,
        [
          {
            opacity: 0,
            transform: 'translateY(28px) scale(0.2) rotate(-24deg)',
          },
          {
            opacity: 1,
            transform: 'translateY(-6px) scale(1.16) rotate(6deg)',
            offset: 0.55,
          },
          {
            transform: 'translateY(2px) scale(0.95) rotate(-2deg)',
            offset: 0.8,
          },
          { opacity: 1, transform: 'none' },
        ],
        {
          duration: POP,
          delay,
          easing: 'cubic-bezier(.2,.8,.25,1)',
          fill: 'both',
        },
      );
      // Into the balance where it is on screen; up and away where it is not.
      const rest = rests[index];
      const to = target ? centre(target) : { x: rest.x, y: rest.y - 90 };
      const away = `translate(${to.x - rest.x}px, ${to.y - rest.y}px)`;
      run(
        coin,
        [
          { opacity: 1, transform: 'none' },
          {
            opacity: target ? 0.9 : 0.4,
            transform: `${away} scale(${target ? 0.32 : 0.6})`,
            offset: 0.85,
          },
          { opacity: 0, transform: `${away} scale(${target ? 0.18 : 0.5})` },
        ],
        {
          duration: FLY,
          delay: LEAVE_AT + index * FLY_STAGGER,
          easing: 'cubic-bezier(.55,0,.8,.3)',
          fill: 'forwards',
        },
      );
    });
    const stagger = (parts.coins.length - 1) * POP_STAGGER;
    run(
      parts.glow,
      [
        { opacity: 0, transform: 'scale(0.4)' },
        { opacity: 1, transform: 'scale(1)', offset: 0.18 },
        { opacity: 0.85, transform: 'scale(1.05)', offset: 0.7 },
        { opacity: 0, transform: 'scale(1.2)' },
      ],
      { duration: LEAVE_AT + FLY, easing: 'ease-out', fill: 'both' },
    );
    run(
      parts.burst,
      [
        { opacity: 0.95, transform: 'scale(0.3)' },
        { opacity: 0, transform: 'scale(2.6)' },
      ],
      {
        duration: 760,
        delay: 140 + stagger / 2,
        easing: 'cubic-bezier(.1,.7,.3,1)',
        fill: 'both',
      },
    );
    parts.sparks.forEach((spark, index) => {
      const { x, y } = sparkPath(index, parts.sparks.length);
      run(
        spark,
        [
          { opacity: 0, transform: 'translate(0, 0) scale(0.2) rotate(0deg)' },
          {
            opacity: 1,
            transform: `translate(${x * 0.55}px, ${y * 0.55}px) scale(1.1) rotate(70deg)`,
            offset: 0.35,
          },
          {
            opacity: 0,
            transform: `translate(${x}px, ${y}px) scale(0.3) rotate(160deg)`,
          },
        ],
        {
          duration: 820 + (index % 3) * 90,
          delay: 160 + stagger / 2 + (index % 4) * 30,
          easing: 'cubic-bezier(.15,.7,.35,1)',
          fill: 'both',
        },
      );
    });
    run(
      parts.line,
      [
        { opacity: 0, transform: 'translateY(14px) scale(0.92)' },
        { opacity: 1, transform: 'translateY(0) scale(1.04)', offset: 0.6 },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 420,
        delay: 240 + stagger,
        easing: 'cubic-bezier(.2,.8,.25,1)',
        fill: 'both',
      },
    );
    run(
      parts.line,
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'translateY(-10px)' },
      ],
      {
        duration: 360,
        delay: LEAVE_AT + 260,
        easing: 'ease-in',
        fill: 'forwards',
      },
    );
  }

  const finished = Promise.allSettled(
    animations.map((animation) => animation.finished),
  ).then(() => undefined);
  return {
    finished,
    skip: () => animations.forEach((animation) => animation.cancel()),
  };
};
