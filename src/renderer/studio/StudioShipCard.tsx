import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import StudioShipMore, { type IShipMoreItem } from './StudioShipMore';

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
}

/**
 * What to do with the scene once it plays, at the end of the Studio's bar
 * (layout A, Ivan 2026-09-27): publish it to the gallery, keep it in the
 * member's looks, and behind More, send it as a file or play it on the
 * desktop. A maker's own scene plays in their looks and on the graph
 * whether or not it is published: they try it there until it is done, and
 * publish it to share it and earn (Ivan, 2026-10-21: "they will publish to
 * earn money when the scene is fully done and tested in the grahp"). So Add
 * wears the loud style, the step taken over and over while a scene is made,
 * and Publish the quiet one; the bench shows `StudioShipInspect` for one of
 * FluidEQ's scenes opened to look inside.
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
}: IStudioShipCardProps) {
  const { t } = useTranslation();
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
      <button
        type="button"
        className={`button small subtle${publishing ? ' is-running' : ''}`}
        aria-busy={publishing}
        onClick={onPublish}
        disabled={unfit}
      >
        <Glyph name="upload" />
        {t('studio.action.publish')}
      </button>
      {/* Quiet beside Add: it adds too, and then leaves the Studio for the
          graph, which is a step taken now and then, not at every save. */}
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
        className="button small studio-ship__add"
        onClick={onAdd}
        disabled={unfit}
      >
        <Glyph name="looks" />
        {t('studio.action.addToLooks')}
      </button>
    </div>
  );
}
