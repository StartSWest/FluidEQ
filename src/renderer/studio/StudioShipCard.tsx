import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useDocumentShown from '../utils/useDocumentShown';
import StudioShipMore, { type IShipMoreItem } from './StudioShipMore';
import type { TPublishCall } from './versionLine';

interface IStudioShipCardProps {
  /** No scene that plays and passes, so nothing can be kept or sent yet. */
  unfit: boolean;
  onAdd: () => void;
  /** Keeps it in the looks, chooses it on the graph and shows the graph. */
  onPlay: () => void;
  publishing: boolean;
  onPublish: () => void;
  exporting: boolean;
  onExport: () => void;
  /** Absent on a computer that cannot put a visualizer on its desktop. */
  onSetDesktop: (() => void) | undefined;
  settingDesktop: boolean;
  /**
   * Why the scene does not play yet, in plain words (`unfitReason.ts`):
   * said under "Put on desktop" while it is off, so the press is never one
   * that does nothing. Absent while the scene is only still being built.
   */
  unfitReason: string | undefined;
  /** Brings the scene's problems under the stage into view. */
  onShowProblems: () => void;
  /**
   * How loudly Publish asks to be pressed (`versionLine.ts`): loud while
   * there is something to publish, with a light running round it while the
   * bench has changes people do not have.
   */
  publishCall: TPublishCall;
}

/**
 * What to do with the scene once it plays, at the end of the Studio's bar
 * (layout A, Ivan 2026-09-27): publish it to the gallery, keep it in the
 * member's looks, play it on the graph, and behind More, send it as a file
 * or play it on the desktop.
 *
 * Publish is the bar's main action and stands last, where the eye ends the
 * bar (Ivan, 2026-11-25: "we have Add to my looks as the default, which I
 * don't think should be the default. Should be Publish"). It wears the loud
 * style while there is something to publish - changes the gallery does not
 * have, or a scene never published - and a light runs round its edge while
 * those changes wait (`button.is-beckoning`); everything else here is
 * quiet. With nothing to publish no button is loud: emphasis follows a
 * recommendation, and there is none. One control per action: the line
 * beside the project names the state and carries no Publish of its own.
 * The bench shows `StudioShipInspect` for one of FluidEQ's scenes opened
 * to look inside.
 *
 * In the bar they are in reach wherever the page was left: at the foot of the
 * side column they were a card pinned over everything that scrolled there.
 */
export default function StudioShipCard({
  unfit,
  onAdd,
  onPlay,
  publishing,
  onPublish,
  exporting,
  onExport,
  onSetDesktop,
  settingDesktop,
  unfitReason,
  onShowProblems,
  publishCall,
}: IStudioShipCardProps) {
  const { t } = useTranslation();
  // The light runs only where somebody can see it, and never on a button
  // that cannot be pressed or is already publishing.
  const shown = useDocumentShown();
  const beckoning = publishCall === 'changes' && shown && !unfit && !publishing;
  const more: IShipMoreItem[] = [
    {
      key: 'export',
      glyph: 'send',
      label: t('studio.action.export'),
      busy: exporting,
      disabled: unfit,
      onSelect: () => {
        if (!exporting) {
          onExport();
        }
      },
    },
  ];
  if (onSetDesktop) {
    more.push({
      key: 'desktop',
      glyph: 'monitor',
      label: t('studio.action.desktop'),
      busy: settingDesktop,
      disabled: unfit,
      onSelect: () => {
        if (!settingDesktop) {
          onSetDesktop();
        }
      },
      // Said only while the item is off: the menu shows a why for nothing else.
      ...(unfitReason
        ? {
            why: {
              reason: t('studio.unfit.lead', { reason: unfitReason }),
              step: t('studio.unfit.show'),
              glyph: 'alert' as const,
              onStep: onShowProblems,
            },
          }
        : {}),
    });
  }
  return (
    <div
      className="studio-ship"
      role="group"
      aria-label={t('studio.ship.title')}
    >
      <StudioShipMore items={more} />
      {/* Quiet: it adds too, and then leaves the Studio for the graph, a
          step taken now and then, not at every save. */}
      <button
        type="button"
        className="button small subtle"
        onClick={onPlay}
        disabled={unfit}
      >
        <Glyph name="graph-play" />
        {t('studio.action.playOnGraph')}
      </button>
      <button
        type="button"
        className="button small subtle studio-ship__add"
        onClick={onAdd}
        disabled={unfit}
      >
        <Glyph name="looks" />
        {t('studio.action.addToLooks')}
      </button>
      <button
        type="button"
        className={`button small studio-ship__publish${
          publishCall !== 'changes' ? ' subtle' : ''
        }${beckoning ? ' is-beckoning' : ''}${publishing ? ' is-running' : ''}`}
        aria-busy={publishing}
        onClick={onPublish}
        disabled={unfit}
      >
        <Glyph name="upload" />
        {t('studio.action.publish')}
      </button>
    </div>
  );
}
