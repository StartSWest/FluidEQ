import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ANIMATION_GROUNDS,
  type TAnimationGround,
} from 'common/studioAnimation';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import AnimationFrame from './AnimationFrame';
import type { IAnimationPlayer, TAnimationSlope } from './useAnimationPlayer';
import type { IViewedAnimation } from './useStudioAnimations';

const GROUND_KEYS: Record<TAnimationGround, TranslationKey> = {
  none: 'studio.animation.ground.none',
  ground: 'studio.animation.ground.ground',
  sky: 'studio.animation.ground.sky',
  water: 'studio.animation.ground.water',
};

const SLOPES: readonly TAnimationSlope[] = ['flat', 'up', 'down'];
const SLOPE_KEYS: Record<TAnimationSlope, TranslationKey> = {
  flat: 'studio.animation.slope.flat',
  up: 'studio.animation.slope.up',
  down: 'studio.animation.slope.down',
};

/** Where the base line meets the stage's left and right edges, as shares of its height. */
const BASE_LINE: Record<TAnimationSlope, readonly [number, number]> = {
  flat: [0.8, 0.8],
  up: [0.9, 0.68],
  down: [0.68, 0.9],
};

/** The water's surface, as a share of the stage's height. */
const WATER_LINE = 0.3;

interface IPlace {
  width: number;
  height: number;
  left: number;
  top: number;
  /** Radians: the creature leans with the ground it walks on. */
  tilt: number;
  /** Where the leaning turns round, as shares of the creature's box. */
  pivot: number;
}

/**
 * Where the creature stands on a stage `width` by `height`: on the base line
 * by its lowest foot (`feetLine`), in the sky's middle, under the water, or
 * as large as the stage with nothing behind it - always at its frame's own
 * shape, as large as that place allows.
 */
const placeOf = (
  ground: TAnimationGround,
  slope: TAnimationSlope,
  aspect: number,
  feetLine: number,
  width: number,
  height: number,
): IPlace => {
  const fit = (tallest: number, widest: number) => {
    const boxHeight = Math.min(tallest, widest / aspect);
    return { boxHeight, boxWidth: boxHeight * aspect };
  };
  if (ground === 'ground') {
    const [left, right] = BASE_LINE[slope];
    const line = ((left + right) / 2) * height;
    const { boxWidth, boxHeight } = fit(height * 0.62, width * 0.8);
    return {
      width: boxWidth,
      height: boxHeight,
      left: (width - boxWidth) / 2,
      top: line - boxHeight * feetLine,
      tilt: Math.atan2((right - left) * height, width),
      pivot: feetLine,
    };
  }
  const tallest = { none: 0.9, sky: 0.6, water: 0.5 }[ground];
  const middle = { none: 0.5, sky: 0.42, water: 0.66 }[ground];
  const { boxWidth, boxHeight } = fit(height * tallest, width * 0.86);
  return {
    width: boxWidth,
    height: boxHeight,
    left: (width - boxWidth) / 2,
    top: middle * height - boxHeight / 2,
    tilt: 0,
    pivot: 0.5,
  };
};

interface IAnimationStageProps {
  viewed: IViewedAnimation;
  player: IAnimationPlayer;
  /** What stands in the stage's lower right corner: the way to a larger view. */
  corner?: ReactNode;
}

/**
 * An opened animation's stage: the creature playing on a background chosen
 * only for working on it (Ivan, 2026-11-09: "a base floor for creatures that
 * walk ... so it looks like they are walking on top of a platform or road",
 * "in land it can have elevation to test inclination", "flying creatures
 * they are put in the sky", "water for water creatures", "we can toggle that
 * bg on and off", "only visible inside the editor"). The scene, the cards
 * and anything published show the creature alone.
 */
export default function AnimationStage({
  viewed,
  player,
  corner,
}: IAnimationStageProps) {
  const { t } = useTranslation();
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { animation } = viewed;
  const { ground, slope, frame } = player;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize((now) =>
        now.width === box.width && now.height === box.height
          ? now
          : { width: box.width, height: box.height },
      );
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const place = placeOf(
    ground,
    slope,
    viewed.aspect,
    viewed.feetLine ?? 1,
    size.width,
    size.height,
  );
  const [lineLeft, lineRight] = BASE_LINE[slope];
  const creature: CSSProperties = {
    left: place.left,
    top: place.top,
    width: place.width,
    height: place.height,
    transform: `rotate(${place.tilt}rad)`,
    transformOrigin: `50% ${place.pivot * 100}%`,
  };

  return (
    <div
      ref={stageRef}
      className={`studio-animation-stage is-${ground}`}
      data-testid="animation-stage"
    >
      {ground === 'ground' && (
        <svg
          className="studio-animation-stage__land"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            className="studio-animation-stage__soil"
            points={`0,${lineLeft * 100} 100,${lineRight * 100} 100,100 0,100`}
          />
          <polygon
            className="studio-animation-stage__shade"
            points={`0,${lineLeft * 100 + 7} 100,${lineRight * 100 + 7} 100,100 0,100`}
          />
          <polyline
            className="studio-animation-stage__line"
            points={`0,${lineLeft * 100} 100,${lineRight * 100}`}
          />
        </svg>
      )}
      {ground === 'water' && (
        <span
          className="studio-animation-stage__surface"
          style={{ top: `${WATER_LINE * 100}%` }}
          aria-hidden="true"
        />
      )}
      {size.width > 0 && (
        <div className="studio-animation-stage__creature" style={creature}>
          <AnimationFrame
            className="studio-animation-stage__frame"
            viewed={viewed}
            frame={frame}
            onion={player.onion}
            label={t('studio.animation.frameLabel', {
              name: animation.name,
              frame: frame + 1,
            })}
          />
        </div>
      )}
      {ground === 'ground' && (
        <span
          className="studio-animation-stage__tag studio-animation-stage__tag--line"
          style={{
            top: `calc(${Math.min(lineLeft, lineRight) * 100}% - 30px)`,
          }}
        >
          {t('studio.animation.baseline')}
        </span>
      )}
      <span className="studio-animation-stage__tag studio-animation-stage__count">
        {t('studio.animation.frameOf', {
          frame: frame + 1,
          count: animation.count,
        })}
      </span>
      <div
        className="studio-animation-stage__chooser studio-animation-stage__chooser--ground studio-segments"
        role="group"
        aria-label={t('studio.animation.background')}
      >
        {ANIMATION_GROUNDS.map((each) => (
          <button
            key={each}
            type="button"
            className="studio-segment"
            aria-pressed={ground === each}
            onClick={() => player.setGround(each)}
          >
            {t(GROUND_KEYS[each])}
          </button>
        ))}
      </div>
      {ground === 'ground' && (
        <div
          className="studio-animation-stage__chooser studio-animation-stage__chooser--slope studio-segments"
          role="group"
          aria-label={t('studio.animation.slope')}
        >
          {SLOPES.map((each) => (
            <button
              key={each}
              type="button"
              className="studio-segment"
              aria-pressed={slope === each}
              onClick={() => player.setSlope(each)}
            >
              {t(SLOPE_KEYS[each])}
            </button>
          ))}
        </div>
      )}
      {corner && <div className="studio-animation-stage__corner">{corner}</div>}
    </div>
  );
}
