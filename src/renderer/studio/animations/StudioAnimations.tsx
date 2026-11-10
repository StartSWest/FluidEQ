import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import useMovablePortal from '../../utils/useMovablePortal';
import StudioAskCard from '../StudioAskCard';
import AnimationFrame from './AnimationFrame';
import AnimationView from './AnimationView';
import type { IChosenFile } from './import/importFiles';
import StudioAnimationImport from './import/StudioAnimationImport';
import StudioAnimationImportCard, {
  allowFileDrop,
  dropFiles,
} from './import/StudioAnimationImportCard';
import StudioAnimationModal from './StudioAnimationModal';
import StudioAnimatorColumn, {
  ANIMATOR_LARGE_WIDTH_KEY,
  ANIMATOR_WIDTH_KEY,
} from './StudioAnimatorColumn';
import useAnimationPlayer, { useLoopFrame } from './useAnimationPlayer';
import type { IViewedAnimation } from './useStudioAnimations';
import '../../styles/StudioAnimations.scss';

/** "8 frames · 9 fps · loops", or "plays once". */
const useMeta = () => {
  const { t } = useTranslation();
  return ({ animation }: IViewedAnimation) =>
    t(animation.loop ? 'studio.animation.meta' : 'studio.animation.metaOnce', {
      count: animation.count,
      fps: animation.fps,
    });
};

function AnimationCard({
  viewed,
  working,
  onOpen,
}: {
  viewed: IViewedAnimation;
  /** Its animator is writing a reply. */
  working: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const meta = useMeta();
  const frame = useLoopFrame(viewed);
  const { animation } = viewed;
  return (
    <li className="studio-animation-card">
      <button
        type="button"
        className="studio-animation-card__open"
        aria-label={t('studio.animation.open', { name: animation.name })}
        onClick={onOpen}
      >
        <span className="studio-animation-card__frame">
          {viewed.bitmap ? (
            <AnimationFrame
              className="studio-animation-card__art"
              viewed={viewed}
              frame={frame}
            />
          ) : (
            <span className="studio-animation-card__unreadable">
              <Glyph name="alert" />
              {t('studio.animation.unreadable')}
            </span>
          )}
          {working && (
            <span className="studio-animation-card__working">
              <span
                className="studio-animation-card__lamp"
                aria-hidden="true"
              />
              {t('studio.animator.working', { name: animation.name })}
            </span>
          )}
          {viewed.bitmap && (
            <span className="studio-animation-card__count">
              {t('studio.animation.frameOf', {
                frame: frame + 1,
                count: animation.count,
              })}
            </span>
          )}
        </span>
        <span className="studio-animation-card__about">
          <span className="studio-animation-card__name">{animation.name}</span>
          <span className="studio-animation-card__meta">{meta(viewed)}</span>
        </span>
      </button>
    </li>
  );
}

interface IOpenedProps {
  viewed: IViewedAnimation;
  onBack: () => void;
  /** Beside the animation: the agent working on it. */
  side?: ReactNode;
}

function OpenedAnimation({ viewed, onBack, side }: IOpenedProps) {
  const { t } = useTranslation();
  const meta = useMeta();
  const player = useAnimationPlayer(viewed);
  const [large, setLarge] = useState(false);
  // The animator goes with the animation into the bigger view and back
  // (Ivan, 2026-11-09: "the full screen there needs to attach the chat too
  // so I can work better focused on animator"): one chat, moved, so what
  // is being written and a question it asks are there in either place.
  const animator = useMovablePortal(side, 'studio-animator-host');
  const animatorIn = (storageKey: string) =>
    side ? (
      <StudioAnimatorColumn storageKey={storageKey}>
        <div ref={animator.place} className="studio-animator-slot" />
      </StudioAnimatorColumn>
    ) : undefined;
  return (
    <div className="studio-animation-opened">
      <div className="studio-animation-opened__head">
        <button
          type="button"
          className="button small subtle studio-animation-opened__back"
          onClick={onBack}
        >
          <Glyph name="previous" />
          {t('studio.animation.back')}
        </button>
        <span className="studio-animation-opened__name">
          {viewed.animation.name}
        </span>
        <span className="studio-animation-opened__meta">
          {meta(viewed)} · {viewed.animation.sheet}
        </span>
      </div>
      <div className="studio-animation-opened__work">
        <div className="studio-animation-opened__view">
          {/* Not shown under the open modal: one view of it on screen. */}
          {!large && (
            <AnimationView
              viewed={viewed}
              player={player}
              stageCorner={
                <button
                  type="button"
                  className="studio-animation-stage__expand"
                  aria-label={t('studio.animation.expand')}
                  title={t('studio.animation.expand')}
                  onClick={() => setLarge(true)}
                >
                  <Glyph name="expand" />
                </button>
              }
            />
          )}
          <p className="studio-pictures__lead">
            {t('studio.animation.backgroundNote')}
          </p>
        </div>
        {!large && animatorIn(ANIMATOR_WIDTH_KEY)}
      </div>
      {side && animator.portal}
      {large && (
        <StudioAnimationModal
          viewed={viewed}
          player={player}
          side={animatorIn(ANIMATOR_LARGE_WIDTH_KEY)}
          onClose={() => setLarge(false)}
        />
      )}
    </div>
  );
}

interface IStudioAnimationsProps {
  animations: IViewedAnimation[];
  /** The agent working on the opened animation, beside it. */
  renderSide?: (viewed: IViewedAnimation) => ReactNode;
  /** Whether an animation's animator is at work, for its card. */
  isWorking?: (name: string) => boolean;
}

/**
 * The Studio's Animations tab (Ivan, 2026-11-09: "another tab next to pic
 * animations ... clicking one will show all its frames in play mode and be
 * able to jump one by one next or back"): every animation in the project
 * playing its loop as it does in the scene, and one opened to step through,
 * try against a ground and see bigger.
 */
export default function StudioAnimations({
  animations,
  renderSide,
  isWorking,
}: IStudioAnimationsProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [opened, setOpened] = useState<string>();
  const [importing, setImporting] = useState<IChosenFile[]>();
  const chooser = useRef<HTMLInputElement>(null);
  const shown = animations.find(({ animation }) => animation.name === opened);
  const names = useMemo(
    () => new Set(animations.map(({ animation }) => animation.name)),
    [animations],
  );

  if (shown?.bitmap) {
    return (
      <section
        className="studio-card studio-animations"
        aria-label={shown.animation.name}
      >
        <OpenedAnimation
          key={shown.animation.name}
          viewed={shown}
          onBack={() => setOpened(undefined)}
          side={renderSide?.(shown)}
        />
      </section>
    );
  }

  return (
    // Files dropped anywhere on the tab are an import, as chosen ones are.
    <section
      className="studio-card studio-animations"
      aria-labelledby={titleId}
      onDragOver={allowFileDrop}
      onDrop={dropFiles(setImporting)}
    >
      <div className="studio-pictures__head">
        <span className="studio-card__eyebrow" id={titleId}>
          {t('studio.animation.title')}
        </span>
        <span className="studio-pictures__lead">
          {t('studio.animation.lead')}
        </span>
      </div>
      <ul className="studio-animations__list">
        {animations.map((viewed) => (
          <AnimationCard
            key={viewed.animation.name}
            viewed={viewed}
            working={isWorking?.(viewed.animation.name) ?? false}
            onOpen={() => setOpened(viewed.animation.name)}
          />
        ))}
        <StudioAskCard
          title={t('studio.animation.askTitle')}
          example={t('studio.animation.askExample')}
        />
        <StudioAnimationImportCard inputRef={chooser} onFiles={setImporting} />
      </ul>
      {importing && (
        <StudioAnimationImport
          files={importing}
          taken={names}
          onChooseAgain={() => {
            setImporting(undefined);
            chooser.current?.click();
          }}
          // The new animation opens once main says its files changed and
          // `useStudioAnimations` has read them; until then the cards stay.
          onAdded={(added) => {
            setImporting(undefined);
            setOpened(added[0]);
          }}
          onClose={() => setImporting(undefined)}
        />
      )}
    </section>
  );
}
