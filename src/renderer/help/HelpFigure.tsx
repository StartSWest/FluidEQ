/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type CSSProperties, useState } from 'react';
import {
  helpCaptureWidth,
  helpPieceScale,
  type IHelpControl,
  type IHelpFigure,
  type THelpBox,
} from 'common/helpGuide';
import { useTranslation } from '../utils/I18nContext';

/** Where a box sits on the capture, as percentages, so it follows its size. */
const placed = (
  figure: IHelpFigure,
  [x, y, width, height]: THelpBox,
): CSSProperties => ({
  left: `${(x / figure.width) * 100}%`,
  top: `${(y / figure.height) * 100}%`,
  width: `${(width / figure.width) * 100}%`,
  height: `${(height / figure.height) * 100}%`,
});

/** The capture itself as the piece's background, moved so only the icon shows. */
const pieceStyle = (
  src: string,
  figure: IHelpFigure,
  icon: THelpBox,
): CSSProperties => {
  const [x, y, width, height] = icon;
  const scale = helpPieceScale(icon);
  return {
    width: width * scale,
    height: height * scale,
    backgroundImage: `url("${src}")`,
    backgroundSize: `${figure.width * scale}px ${figure.height * scale}px`,
    backgroundPosition: `${-x * scale}px ${-y * scale}px`,
  };
};

interface IHelpFigureProps {
  figure: IHelpFigure;
  /** The capture's bundled address. */
  src: string;
  /** What the capture is called: its caption, or else the chapter's title. */
  title: string;
  onEnlarge: () => void;
}

/**
 * One capture and every control it explains, beside it when there is room.
 *
 * A control with a picture worth repeating carries its own piece of the
 * capture rather than a redrawing of its icon, so the icon a reader is told
 * about is exactly the one they will look for, and it cannot drift from the
 * capture when an icon changes. Pointing at a line rings its control on the
 * capture.
 */
export default function HelpFigure({
  figure,
  src,
  title,
  onEnlarge,
}: IHelpFigureProps) {
  const { t } = useTranslation();
  const [pointed, setPointed] = useState<IHelpControl>();
  const controls = figure.controls ?? [];
  const width = helpCaptureWidth(figure);

  return (
    <figure className="help-figure">
      {figure.caption && (
        <h3 className="help-figure__caption">{t(figure.caption)}</h3>
      )}
      <div className="help-figure__body">
        <div
          className="help-figure__shot"
          style={{ flexBasis: width, maxWidth: width }}
        >
          <div className="help-figure__frame">
            <button
              type="button"
              className="help-guide__capture"
              aria-label={t('help.enlarge', { title })}
              onClick={onEnlarge}
            >
              <img
                src={src}
                alt={title}
                loading="lazy"
                width={figure.width}
                height={figure.height}
              />
            </button>
            {pointed && (
              <span
                className="help-figure__ring"
                aria-hidden="true"
                style={placed(figure, pointed.box)}
              />
            )}
          </div>
          <figcaption>{t('help.enlarge', { title })}</figcaption>
        </div>
        {controls.length > 0 && (
          <ul
            className="help-controls"
            aria-label={t('help.controlsOf', { title })}
          >
            {controls.map((control) => (
              <li
                key={control.text}
                className={`help-control${control.icon ? '' : ' help-control--plain'}`}
                onPointerEnter={() => setPointed(control)}
                onPointerLeave={() => setPointed(undefined)}
              >
                {control.icon && (
                  <span className="help-control__well" aria-hidden="true">
                    <span
                      className="help-control__piece"
                      style={pieceStyle(src, figure, control.icon)}
                    />
                  </span>
                )}
                <span className="help-control__body">
                  <span className="help-control__name">
                    <strong>{t(control.name)}</strong>
                    {control.keys && <kbd>{control.keys}</kbd>}
                  </span>
                  <span className="help-control__text">{t(control.text)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </figure>
  );
}
