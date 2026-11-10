import { useId, useMemo, useRef, useState } from 'react';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import AnimationCard from './AnimationCard';
import AnimationHistoryBar from './AnimationHistoryBar';
import { showAnimationFile, useRemovalAsked } from './animationActions';
import { AnimationsEmpty, AnimationsHint } from './AnimationsAsk';
import AnimationView from './AnimationView';
import useFileDrop from './import/importDrop';
import type { IChosenFile } from './import/importFiles';
import StudioAnimationImport from './import/StudioAnimationImport';
import StudioAnimationImportButton from './import/StudioAnimationImportButton';
import DeleteAnimationDialog from './DeleteAnimationDialog';
import RenameAnimationDialog from './RenameAnimationDialog';
import StudioAnimationModal from './StudioAnimationModal';
import useAnimationDelete from './useAnimationDelete';
import useAnimationPlayer from './useAnimationPlayer';
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

interface IOpenedProps {
  viewed: IViewedAnimation;
  onBack: () => void;
}

function OpenedAnimation({ viewed, onBack }: IOpenedProps) {
  const { t } = useTranslation();
  const meta = useMeta();
  const player = useAnimationPlayer(viewed);
  const [large, setLarge] = useState(false);
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
        <AnimationHistoryBar name={viewed.animation.name} revision={viewed} />
      </div>
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
      {large && (
        <StudioAnimationModal
          viewed={viewed}
          player={player}
          onClose={() => setLarge(false)}
        />
      )}
    </div>
  );
}

function ListedCard({
  projectId,
  viewed,
  unused,
  onOpen,
  onRename,
  onDelete,
}: {
  projectId: string;
  viewed: IViewedAnimation;
  unused: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const meta = useMeta();
  const { name } = viewed.animation;
  return (
    <AnimationCard
      viewed={viewed}
      meta={meta(viewed)}
      removing={useRemovalAsked(projectId, name)}
      unused={unused}
      onOpen={onOpen}
      onRename={onRename}
      onShow={() => {
        showAnimationFile(name).catch(() => undefined);
      }}
      onDelete={onDelete}
    />
  );
}

interface IStudioAnimationsProps {
  /** The open project, whose chat is asked for animations. */
  projectId: string;
  animations: IViewedAnimation[];
}

/**
 * The Studio's Animations tab (Ivan, 2026-11-09: "another tab next to pic
 * animations ... clicking one will show all its frames in play mode and be
 * able to jump one by one next or back"): every animation in the project
 * playing its loop as it does in the scene, and one opened to step through,
 * try against a ground and see bigger.
 */
export default function StudioAnimations({
  projectId,
  animations,
}: IStudioAnimationsProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [opened, setOpened] = useState<string>();
  const [importing, setImporting] = useState<IChosenFile[]>();
  const chooser = useRef<HTMLInputElement>(null);
  const drop = useFileDrop(setImporting);
  const [renaming, setRenaming] = useState<string>();
  const removal = useAnimationDelete(animations);
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
        />
      </section>
    );
  }

  return (
    // Files dropped anywhere on the tab are an import, as chosen ones are.
    <section
      className={`studio-card studio-animations${drop.over ? ' is-dropping' : ''}`}
      aria-labelledby={titleId}
      onDragEnter={drop.onDragEnter}
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
    >
      <div className="studio-animations__head">
        <div className="studio-pictures__head">
          <span className="studio-card__eyebrow" id={titleId}>
            {t('studio.animation.title')}
          </span>
          <span className="studio-pictures__lead">
            {t('studio.animation.lead')}
          </span>
        </div>
        <StudioAnimationImportButton
          inputRef={chooser}
          onFiles={setImporting}
        />
      </div>
      {animations.length === 0 ? (
        <AnimationsEmpty projectId={projectId} />
      ) : (
        <>
          <AnimationsHint projectId={projectId} />
          <ul className="studio-animations__list">
            {animations.map((viewed) => (
              <ListedCard
                key={viewed.animation.name}
                projectId={projectId}
                viewed={viewed}
                unused={removal.usage(viewed) === 'unused'}
                onOpen={() => setOpened(viewed.animation.name)}
                onRename={() => setRenaming(viewed.animation.name)}
                onDelete={() => removal.start(viewed)}
              />
            ))}
          </ul>
        </>
      )}
      {drop.over && (
        <div className="studio-animations__drop" aria-hidden="true">
          <Glyph name="upload" />
          <span>{t('studio.animationImport.drop')}</span>
        </div>
      )}
      {renaming && (
        <RenameAnimationDialog
          name={renaming}
          onClose={() => setRenaming(undefined)}
        />
      )}
      {removal.deleted && (
        <div className="studio-animations__undo" role="status">
          <span>
            {t(removal.deleted.problem ?? 'studio.animation.deleted', {
              name: removal.deleted.name,
            })}
          </span>
          {!removal.deleted.problem && (
            <button
              type="button"
              className="button small subtle"
              onClick={removal.undo}
            >
              {t('studio.animation.undo')}
            </button>
          )}
          <button
            type="button"
            className="studio-animations__undo-close"
            aria-label={t('support.close')}
            onClick={removal.dismiss}
          >
            <Glyph name="close" />
          </button>
        </div>
      )}
      {removal.asking && (
        <DeleteAnimationDialog
          projectId={projectId}
          name={removal.asking.name}
          lead={
            removal.asking.usage === 'used'
              ? 'studio.animation.deleteLeadUsed'
              : 'studio.animation.deleteLead'
          }
          onClose={removal.closeAsking}
        />
      )}
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
