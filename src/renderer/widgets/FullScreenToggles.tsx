/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import {
  toggleFullScreenBottomBar,
  useFullScreenBottomBar,
} from '../utils/fullScreenPins';

interface IFullScreenTogglesProps {
  isFullScreen: boolean;
  /** Whether the header stays on screen in this full screen. */
  hasTopBar: boolean;
  onToggleTopBar: () => void;
  onToggleFullScreen: () => void;
}

/**
 * The three icons that end every page's options row, as the Karaoke's did
 * first (Ivan, 2026-11-16: "the toggles — full screen, the header toggle and
 * the bottom bar toggle — the same as the Karaoke, with the same icons"):
 * the header's pin and the transport's, drawn as each other's mirror and only
 * in full screen, where there is something to pin, and full screen itself.
 *
 * Full screen is last, at the row's end, so the way out is in the same corner
 * on every page. Each is a 32px target (`.view-bar__icon`), and nothing on the
 * row moves it: the row's own band is the only thing round it.
 */
const FullScreenToggles = ({
  isFullScreen,
  hasTopBar,
  onToggleTopBar,
  onToggleFullScreen,
}: IFullScreenTogglesProps) => {
  const { t } = useTranslation();
  const hasBottomBar = useFullScreenBottomBar();
  const headerLabel = t(
    hasTopBar
      ? 'karaoke.fullscreen.hideHeader'
      : 'karaoke.fullscreen.showHeader',
  );
  const barLabel = t(
    hasBottomBar ? 'karaoke.fullscreen.unpinBar' : 'karaoke.fullscreen.pinBar',
  );
  const fullScreenLabel = t(
    isFullScreen ? 'karaoke.fullscreen.exit' : 'karaoke.fullscreen.enter',
  );
  return (
    <span
      className="view-bar__toggles"
      role="group"
      aria-label={t('graph.view.fullscreen')}
    >
      {isFullScreen && (
        <button
          type="button"
          className="view-bar__icon"
          aria-label={headerLabel}
          title={headerLabel}
          aria-pressed={hasTopBar}
          onClick={onToggleTopBar}
        >
          <svg className="view-bar__glyph" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 4.5h16v15H4zM4 9h16" />
          </svg>
        </button>
      )}
      {isFullScreen && (
        <button
          type="button"
          className="view-bar__icon"
          aria-label={barLabel}
          title={barLabel}
          aria-pressed={hasBottomBar}
          onClick={toggleFullScreenBottomBar}
        >
          <svg className="view-bar__glyph" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 4.5h16v15H4zM4 15h16" />
          </svg>
        </button>
      )}
      <button
        type="button"
        className="view-bar__icon"
        aria-label={fullScreenLabel}
        title={fullScreenLabel}
        aria-pressed={isFullScreen}
        onClick={onToggleFullScreen}
      >
        <svg className="view-bar__glyph" viewBox="0 0 24 24" aria-hidden>
          <path
            d={
              isFullScreen
                ? 'M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5'
                : 'M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5'
            }
          />
        </svg>
      </button>
    </span>
  );
};

export default FullScreenToggles;
