import type { TranslationKey } from 'common/i18n';
import Glyph, { type TCommunityGlyph } from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import StudioPictureZoomBar from '../StudioPictureZoomBar';
import type usePictureZoom from '../usePictureZoom';
import type { TSketchTool } from './sketchMarks';

/** What a press on the picture does: draw one of the marks, or frame a crop. */
export type TSketchMode = TSketchTool | 'crop';

/** Ink that reads over any scene: three loud colours and white. */
export const INKS: { colour: string; name: TranslationKey }[] = [
  { colour: '#ff4d5e', name: 'studioChat.sketch.red' },
  { colour: '#ffd23f', name: 'studioChat.sketch.yellow' },
  { colour: '#3ce7d8', name: 'studioChat.sketch.cyan' },
  { colour: '#ffffff', name: 'studioChat.sketch.white' },
];

export interface ISketchWidth {
  share: number;
  text: number;
  name: TranslationKey;
}

/**
 * Pen widths as fractions of the picture's width, so they read the same on
 * any picture; text is set at a size that matches its pen.
 */
export const WIDTHS: ISketchWidth[] = [
  { share: 0.005, text: 0.032, name: 'studioChat.sketch.thin' },
  { share: 0.012, text: 0.05, name: 'studioChat.sketch.thick' },
];

const TOOLS: {
  tool: TSketchMode;
  glyph: TCommunityGlyph;
  name: TranslationKey;
}[] = [
  { tool: 'pen', glyph: 'studio', name: 'studioChat.sketch.pen' },
  { tool: 'arrow', glyph: 'arrow-mark', name: 'studioChat.sketch.arrow' },
  { tool: 'text', glyph: 'text-mark', name: 'studioChat.sketch.text' },
  { tool: 'crop', glyph: 'crop', name: 'studioChat.sketch.crop' },
];

interface IStudioChatSketchToolsProps {
  tool: TSketchMode;
  onTool: (tool: TSketchMode) => void;
  ink: string;
  onInk: (colour: string) => void;
  width: ISketchWidth;
  onWidth: (width: ISketchWidth) => void;
  zoom: ReturnType<typeof usePictureZoom>;
  /** A crop box is framed and big enough to keep. */
  canCrop: boolean;
  onCrop: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canClear: boolean;
  onClear: () => void;
}

/**
 * The sketch's tools: what a press does, the ink and the pen, the zoom, and
 * Undo and Clear. With the crop tool, the inks and pens make way for the
 * one thing it needs — the Crop that applies the box, in the loud style
 * once a box is framed, because it is then the step to take.
 */
export default function StudioChatSketchTools({
  tool,
  onTool,
  ink,
  onInk,
  width,
  onWidth,
  zoom,
  canCrop,
  onCrop,
  canUndo,
  onUndo,
  canClear,
  onClear,
}: IStudioChatSketchToolsProps) {
  const { t } = useTranslation();
  return (
    <div className="studio-chat-sketch__tools">
      <div
        className="studio-chat-sketch__kinds"
        role="radiogroup"
        aria-label={t('studioChat.sketch.tool')}
      >
        {TOOLS.map((entry) => (
          <button
            key={entry.tool}
            type="button"
            role="radio"
            aria-checked={tool === entry.tool}
            aria-label={t(entry.name)}
            title={t(entry.name)}
            onClick={() => onTool(entry.tool)}
          >
            <Glyph name={entry.glyph} />
          </button>
        ))}
      </div>
      {tool === 'crop' ? (
        <button
          type="button"
          className={`button small${canCrop ? '' : ' subtle'} studio-chat-sketch__crop-apply`}
          disabled={!canCrop}
          title={t('studioChat.sketch.cropHint')}
          onClick={onCrop}
        >
          <Glyph name="crop" />
          {t('studioChat.sketch.cropApply')}
        </button>
      ) : (
        <>
          <div
            className="studio-chat-sketch__inks"
            role="radiogroup"
            aria-label={t('studioChat.sketch.ink')}
          >
            {INKS.map((entry) => (
              <button
                key={entry.colour}
                type="button"
                role="radio"
                aria-checked={ink === entry.colour}
                aria-label={t(entry.name)}
                title={t(entry.name)}
                style={{ color: entry.colour }}
                onClick={() => onInk(entry.colour)}
              />
            ))}
          </div>
          <div
            className="studio-chat-sketch__widths"
            role="radiogroup"
            aria-label={t('studioChat.sketch.width')}
          >
            {WIDTHS.map((entry) => (
              <button
                key={entry.share}
                type="button"
                role="radio"
                aria-checked={width === entry}
                className={entry === WIDTHS[0] ? 'is-thin' : 'is-thick'}
                aria-label={t(entry.name)}
                title={t(entry.name)}
                onClick={() => onWidth(entry)}
              >
                <span />
              </button>
            ))}
          </div>
        </>
      )}
      <span className="studio-chat-sketch__gap" />
      <StudioPictureZoomBar
        percent={zoom.percent}
        fitted={!zoom.zoomed}
        canZoomIn={zoom.canZoomIn}
        canZoomOut={zoom.canZoomOut}
        onZoomIn={zoom.zoomIn}
        onZoomOut={zoom.zoomOut}
        onFit={zoom.toFit}
      />
      <button
        type="button"
        className="button small subtle"
        disabled={!canUndo}
        onClick={onUndo}
      >
        {t('studioChat.sketch.undo')}
      </button>
      <button
        type="button"
        className="button small subtle"
        disabled={!canClear}
        onClick={onClear}
      >
        {t('studioChat.sketch.clear')}
      </button>
    </div>
  );
}
