/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import {
  toggleFilmFullScreenTopBar,
  useFilmFullScreenTopBar,
} from '../utils/fullScreenPins';
import { useIsChromeIdle } from '../utils/idleChrome';
import FullScreenToggles from '../widgets/FullScreenToggles';
import ViewBar from '../widgets/ViewBar';

interface IVideoFullScreenRowProps {
  /** The site the page is on, when it is one of the list's. */
  siteName: string | undefined;
  onExit: () => void;
}

/**
 * An Online Media page's row in full screen, where the player's toolbar is
 * not drawn: as every page has one (`ViewBar`; Ivan, 2026-11-16: "the same
 * base bar for all the screens"), where this is and the full-screen icons,
 * the way out at the row's end. The header's pin is a film's
 * (`useFilmFullScreenTopBar`), as over a Library film.
 */
const VideoFullScreenRow = ({ siteName, onExit }: IVideoFullScreenRowProps) => {
  const { t } = useTranslation();
  const isChromeIdle = useIsChromeIdle();
  const hasTopBar = useFilmFullScreenTopBar();
  return (
    <>
      <ViewBar
        className="video-browser__full-bar"
        isIdle={isChromeIdle}
        label={t('tabs.media')}
      >
        <p className="view-bar__crumb">
          <span>{t('tabs.media')}</span>
          {siteName && (
            <>
              <span aria-hidden="true">›</span>
              <strong title={siteName}>{siteName}</strong>
            </>
          )}
        </p>
        <FullScreenToggles
          isFullScreen
          hasTopBar={hasTopBar}
          onToggleTopBar={toggleFilmFullScreenTopBar}
          onToggleFullScreen={onExit}
        />
      </ViewBar>
      {/* The page swallows every move of the pointer over it: the guest is
          another process, and nothing over it reaches this document. So the
          band this row stands in and the window's foot, where the transport
          is reached for, are kept for this document over a full-screen page,
          or the chrome, once gone, could never be brought back with the
          pointer. The band's own top pixels are the window's top edge, which
          brings the header. */}
      <div className="video-browser__edge is-top" aria-hidden />
      <div className="video-browser__edge is-bottom" aria-hidden />
    </>
  );
};

export default VideoFullScreenRow;
