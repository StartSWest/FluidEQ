import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import AnimationFrame from './AnimationFrame';
import AnimationStage from './AnimationStage';
import { ANIMATION_SPEEDS, type IAnimationPlayer } from './useAnimationPlayer';
import type { IViewedAnimation } from './useStudioAnimations';

type TTransport = 'previous' | 'play' | 'pause' | 'next';

/** The transport's solid shapes, the same as the Library's and karaoke's. */
const TransportIcon = ({ name }: { name: TTransport }) => {
  let drawing: ReactNode;
  if (name === 'previous') {
    drawing = (
      <>
        <rect x="6" y="7" width="2.3" height="10" rx="1" />
        <path d="M17.5 6.9v10.2L9.4 12l8.1-5.1z" />
      </>
    );
  } else if (name === 'next') {
    drawing = (
      <>
        <rect x="15.7" y="7" width="2.3" height="10" rx="1" />
        <path d="M6.5 6.9v10.2l8.1-5.1-8.1-5.1z" />
      </>
    );
  } else if (name === 'play') {
    drawing = (
      <path d="M8.6 6.4c0-.8.9-1.2 1.6-.8l7.8 5.6c.6.4.6 1.2 0 1.6l-7.8 5.6c-.7.5-1.6 0-1.6-.8V6.4z" />
    );
  } else {
    drawing = (
      <>
        <rect x="7.5" y="6.5" width="3.4" height="11" rx="1.3" />
        <rect x="13.1" y="6.5" width="3.4" height="11" rx="1.3" />
      </>
    );
  }
  return (
    <svg
      className="studio-animation__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {drawing}
    </svg>
  );
};

interface IAnimationViewProps {
  viewed: IViewedAnimation;
  player: IAnimationPlayer;
  /** What stands in the stage's lower right corner. */
  stageCorner?: ReactNode;
}

/**
 * An opened animation: its stage, then the transport - a frame back, play
 * or pause, a frame on - the speeds and the onion, then every frame in a
 * strip. One view, shown where it opens and again, larger, over the Studio:
 * where it stands decides its size, the same player drives both.
 */
export default function AnimationView({
  viewed,
  player,
  stageCorner,
}: IAnimationViewProps) {
  const { t } = useTranslation();
  const stripRef = useRef<HTMLDivElement>(null);
  const { animation } = viewed;
  const { frame, playing, fps } = player;
  const speeds = [...new Set([...ANIMATION_SPEEDS, animation.fps])].sort(
    (a, b) => a - b,
  );

  // The strip follows the frame, so the lit one is never scrolled off.
  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [frame]);

  return (
    <div className="studio-animation">
      <AnimationStage viewed={viewed} player={player} corner={stageCorner} />
      <div className="studio-animation__controls">
        <div className="studio-animation__transport">
          <button
            type="button"
            className="button small subtle studio-animation__step"
            aria-label={t('studio.animation.previous')}
            onClick={() => player.goTo(frame - 1)}
          >
            <TransportIcon name="previous" />
          </button>
          <button
            type="button"
            className="button small studio-animation__play"
            onClick={player.toggle}
          >
            <TransportIcon name={playing ? 'pause' : 'play'} />
            {t(playing ? 'studio.animation.pause' : 'studio.animation.play')}
          </button>
          <button
            type="button"
            className="button small subtle studio-animation__step"
            aria-label={t('studio.animation.next')}
            onClick={() => player.goTo(frame + 1)}
          >
            <TransportIcon name="next" />
          </button>
        </div>
        <div
          className="studio-animation__speeds studio-segments"
          role="group"
          aria-label={t('studio.animation.speed')}
        >
          {speeds.map((each) => (
            <button
              key={each}
              type="button"
              className="studio-segment"
              aria-pressed={each === fps}
              title={
                each === animation.fps
                  ? t('studio.animation.asMade')
                  : undefined
              }
              onClick={() => player.setFps(each)}
            >
              {t('studio.animation.fps', { fps: each })}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="studio-segment studio-animation__onion"
          aria-pressed={player.onion}
          onClick={() => player.setOnion(!player.onion)}
        >
          {t('studio.animation.onion')}
        </button>
      </div>
      {/* Out of the Tab order, as the picture viewer's strip is: the
          arrows beside play walk the frames. */}
      <div
        ref={stripRef}
        className="studio-animation__strip"
        role="group"
        aria-label={t('studio.animation.strip')}
      >
        {Array.from({ length: animation.count }, (_, index) => (
          <button
            // eslint-disable-next-line react/no-array-index-key -- a frame is its place in the cycle
            key={index}
            type="button"
            className="studio-animation__cell"
            tabIndex={-1}
            aria-label={t('studio.animation.frame', { frame: index + 1 })}
            aria-current={index === frame}
            onClick={() => player.goTo(index)}
          >
            <AnimationFrame
              className="studio-animation__cell-art"
              viewed={viewed}
              frame={index}
            />
            <span className="studio-animation__cell-number">{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
