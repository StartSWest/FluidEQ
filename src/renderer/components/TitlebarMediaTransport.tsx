/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { TMediaTransportAction } from 'main/mediaKeys';
import { useTranslation } from '../utils/I18nContext';

interface ITitlebarMediaTransportProps {
  onAction: (action: TMediaTransportAction) => void;
}

const TitlebarMediaTransport = ({ onAction }: ITitlebarMediaTransportProps) => {
  const { t } = useTranslation();
  return (
    <div className="window-titlebar__transport">
      <button
        type="button"
        className="window-control window-control--media"
        aria-label={t('app.media.previousAria')}
        title={t('app.media.previous')}
        onClick={() => onAction('previous')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            className="window-titlebar__media-icon-fill"
            x="5"
            y="6.5"
            width="2.5"
            height="11"
            rx="1.1"
          />
          <path
            className="window-titlebar__media-icon-fill"
            d="M18.2 6.3v11.4L8.8 12l9.4-5.7z"
          />
        </svg>
      </button>
      {/* Windows exposes this as one toggle key and does not report which
          application consumed it, so the combined glyph is intentionally not
          presented as a playing/paused state. */}
      <button
        type="button"
        className="window-control window-control--media window-control--media-toggle"
        aria-label={t('app.media.playPauseAria')}
        title={t('app.media.playPause')}
        onClick={() => onAction('playPause')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            className="window-titlebar__media-icon-fill"
            d="M4.8 6.7v10.6l7.1-5.3-7.1-5.3z"
          />
          <rect
            className="window-titlebar__media-icon-fill"
            x="14.3"
            y="6.7"
            width="2.5"
            height="10.6"
            rx="1.1"
          />
          <rect
            className="window-titlebar__media-icon-fill"
            x="18.2"
            y="6.7"
            width="2.5"
            height="10.6"
            rx="1.1"
          />
        </svg>
      </button>
      <button
        type="button"
        className="window-control window-control--media"
        aria-label={t('app.media.nextAria')}
        title={t('app.media.next')}
        onClick={() => onAction('next')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            className="window-titlebar__media-icon-fill"
            d="M5.8 6.3v11.4l9.4-5.7-9.4-5.7z"
          />
          <rect
            className="window-titlebar__media-icon-fill"
            x="16.5"
            y="6.5"
            width="2.5"
            height="11"
            rx="1.1"
          />
        </svg>
      </button>
    </div>
  );
};

export default TitlebarMediaTransport;
