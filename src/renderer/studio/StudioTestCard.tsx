import { useId, type ReactNode, type RefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import { OWN_GROUP_TITLE, SETTINGS_GROUP_TITLE } from 'common/settingsGroups';
import ScenePerformanceMenu from '../graph/ScenePerformanceMenu';
import { useTranslation } from '../utils/I18nContext';
import StudioCardGroup from './StudioCardGroup';
import type { TStudioSize } from './StudioStage';
import { STUDIO_SIGNALS, type TStudioSignal } from './studioSignals';
import { SIGNAL_ICONS, SIZE_ICONS } from './studioTestIcons';
import StudioGridSwitch from './StudioGridSwitch';
import StudioTintSwitch from './StudioTintSwitch';
import StudioWaveControls from './StudioWaveControls';
import type { IStudioWave } from './studioWave';

const SIZES: readonly TStudioSize[] = ['graph', 'narrow', 'wide', 'full'];

interface IStudioTestCardProps {
  signal: TStudioSignal;
  onSignal: (signal: TStudioSignal) => void;
  size: TStudioSize;
  onSize: (size: TStudioSize) => void;
  wave: IStudioWave;
  onWave: (wave: IStudioWave) => void;
  /** Letting a wave slider go saves it into the scene, as every setting does. */
  onWaveCommit: () => void;
  /** Back to the wave the scene was published with, or opened with. */
  onWaveReset: () => void;
  canResetWave: boolean;
  /** Nothing is on the stage: the controls stay where they will be, unlit. */
  idle: boolean;
  /** How the scene is running, when it is. */
  cost?: TranslationKey;
  percent: number;
  /**
   * Under the cost line, what the frames are costing right now — written by
   * the bench after every frame, never through React.
   */
  readingRef: RefObject<HTMLSpanElement | null>;
  /**
   * The scene's own settings (`StudioSettings.tsx`) — its controls, how it
   * answers the music, its elements in the window — which belong between the
   * picture and how it is drawn, in the order both surfaces follow.
   */
  settings: ReactNode;
}

/**
 * Everything a scene is tried and tuned with, in one card, in the order both
 * places show it: what only the Studio has (the preview audio, the stage
 * size, the app in the scene's colours), the picture (the grid, the wave's
 * height and position), the visualizer itself (its controls, how it answers
 * the music, its elements in the window) and how hard it is drawn — with the
 * reading that says how it is keeping up under all of it.
 *
 * The order and the headings are `common/settingsGroups.ts`, which the
 * graph's View menu follows as well: the same five things sat in a different
 * order under different names on each surface, so tuning a scene here and
 * then looking at it on the graph meant finding every control twice. Same
 * order, same names; two looks, because a menu floating over the graph and a
 * card in a column are not the same thing.
 *
 * How it is drawn is the menu's own rows on the same choice
 * (`common/scenePerformance.ts`), so a choice made here is the graph's and
 * the desktop's too.
 *
 * The choices are tiles in a fixed grid of four, each drawing what it is over
 * its name. They were pills that wrapped: eight of different widths broke
 * into three ragged rows in the Studio's side column, and where each row
 * broke moved with the language. Four equal columns hold the same shape in
 * every language, and a long name takes a second line inside its own tile
 * instead of pushing its neighbours down. In the narrowest column the names
 * give way to the drawings alone, and the readout under the signals names
 * the one that is playing.
 */
export default function StudioTestCard({
  signal,
  onSignal,
  size,
  onSize,
  wave,
  onWave,
  onWaveCommit,
  onWaveReset,
  canResetWave,
  idle,
  cost,
  percent,
  readingRef,
  settings,
}: IStudioTestCardProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const signalName = (entry: TStudioSignal) =>
    t(`studio.signal.${entry}` as TranslationKey);
  const sizeName = (entry: TStudioSize) =>
    t(`studio.size.${entry}` as TranslationKey);
  return (
    // A card that does not fold, holding four groups that do. It folded as a
    // whole while it was one list of controls; with the groups inside taking
    // themselves away, a fold around all of them is a second way to do the
    // same thing — Ivan: "since we have more collapsibles inside, let's not
    // put that one either, the root one no".
    <section
      className={`studio-card studio-test${idle ? ' is-idle' : ''}`}
      aria-labelledby={titleId}
    >
      <span className="studio-card__eyebrow" id={titleId}>
        {t('studio.test.title')}
      </span>
      <StudioCardGroup group="own" title={t(OWN_GROUP_TITLE.studio)}>
        <span className="studio-card__eyebrow">
          {t('studio.signals.title')}
        </span>
        <div
          className="studio-tiles"
          role="group"
          aria-label={t('studio.signals.title')}
        >
          {STUDIO_SIGNALS.map((entry) => (
            <button
              key={entry}
              type="button"
              className="studio-tile"
              aria-pressed={signal === entry}
              aria-label={signalName(entry)}
              title={`${signalName(entry)}: ${t(
                `studio.signalHint.${entry}` as TranslationKey,
              )}`}
              disabled={idle}
              onClick={() => onSignal(entry)}
            >
              {SIGNAL_ICONS[entry]}
              <span className="studio-tile__name">{signalName(entry)}</span>
            </button>
          ))}
        </div>
        <span className="studio-test__now" role="status">
          <span className="studio-test__now-name">{signalName(signal)}</span>
          {t(`studio.signalHint.${signal}` as TranslationKey)}
        </span>
        <span className="studio-test__hint">{t('studio.signals.hint')}</span>
        <span className="studio-card__eyebrow">{t('studio.size.title')}</span>
        <div
          className="studio-tiles studio-tiles--sizes"
          role="group"
          aria-label={t('studio.size.title')}
        >
          {SIZES.map((entry) => (
            <button
              key={entry}
              type="button"
              className="studio-tile"
              aria-pressed={size === entry}
              aria-label={sizeName(entry)}
              title={sizeName(entry)}
              disabled={idle}
              onClick={() => onSize(entry)}
            >
              {SIZE_ICONS[entry]}
              <span className="studio-tile__name">{sizeName(entry)}</span>
            </button>
          ))}
        </div>
        <StudioTintSwitch />
      </StudioCardGroup>
      <StudioCardGroup group="picture" title={t(SETTINGS_GROUP_TITLE.picture)}>
        <StudioGridSwitch />
        <StudioWaveControls
          wave={wave}
          onWave={onWave}
          onCommit={onWaveCommit}
          onReset={onWaveReset}
          canReset={canResetWave}
          idle={idle}
        />
      </StudioCardGroup>
      <StudioCardGroup
        group="visualizer"
        title={t(SETTINGS_GROUP_TITLE.visualizer)}
      >
        {settings}
      </StudioCardGroup>
      <StudioCardGroup group="drawing" title={t(SETTINGS_GROUP_TITLE.drawing)}>
        <span className="studio-test__hint">
          {t('studio.performance.hint')}
        </span>
        {/* The menu's own rows, in the card rather than floating out of it:
          see `.studio-performance__rows`, which takes the floating surface
          off the list they need for their own styling.

          A group and not a menu. Nothing here floats over anything — these
          are settings in a card, like the sliders above them — and the app
          draws an edge round every dialog and every `[role="menu"]` there
          is (`Rainbow.scss`: `html body :is([role="dialog"], …,
          [role="menu"]…)`, which out-weighs three classes, and its rainbow
          twin in euphoria). Declaring a menu here is what drew the box
          round these rows that Ivan asked to have taken off. */}
        <div
          className="graph-view-menu__list studio-performance__rows"
          role="group"
          aria-label={t('studio.performance.title')}
        >
          <ScenePerformanceMenu />
        </div>
      </StudioCardGroup>
      {/* Under the groups, never inside one: how the scene is keeping up is
          the card's one live reading, and the reason somebody looks at it. */}
      {cost && (
        <span className={`studio-cost studio-cost--${cost.split('.').pop()}`}>
          <span className="studio-cost__dot" aria-hidden="true" />
          {t(cost, { percent })}
          <span className="studio-cost__reading" ref={readingRef} />
        </span>
      )}
    </section>
  );
}
