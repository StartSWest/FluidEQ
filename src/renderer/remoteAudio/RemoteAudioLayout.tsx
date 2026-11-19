/* FluidEQ — GPL-3.0-or-later */
import type { ReactNode } from 'react';
import type { ILibraryRailWidth } from '../library/LibraryRailSplitter';
import { useTranslation } from '../utils/I18nContext';
import { FixedStudioRail } from '../widgets/StudioRail';
import '../styles/RemoteAudio.scss';

/**
 * Where the mix rail's dragged width is remembered (`useRailWidth`): a width
 * of the page's own. It has no pin: the rail stays open (`FixedStudioRail`).
 */
export const SHARE_RAIL_WIDTH_KEY = 'fluideq.shareRailWidth';

interface IRemoteAudioLayoutProps {
  /** The rail's width and its drag (`useRailWidth`). */
  rail: ILibraryRailWidth;
  /** Your mix: the faders, each led by its mute button. */
  mix: ReactNode;
  /** The output the mix plays through, after the faders. */
  output: ReactNode;
  /** The page's head, the group, the notices and the page's own words. */
  children: ReactNode;
}

/**
 * SHARE AUDIO, LAID OUT AS THE LIBRARY IS (Ivan, 2026-11-19: "clean, clear,
 * without so many lines and borders, the way the Library is, with the left
 * panel as it is there, resizable, and togglable").
 *
 * One card, the page's: the mix down the studio rail (the one the DSP page
 * stands on - the Library's hairline, splitter and width memory, and the
 * page's name in its head), and the group beside it on the card's own floor.
 * The mix was a card of its own at the right of the group, and the group a
 * card with a framed header; both are gone.
 *
 * Always open (`FixedStudioRail`): folded to a column of mute buttons the
 * mix said nothing a fader says (Ivan, 2026-11-19: "not good in Share Audio,
 * don't do collapsible"). Dragged wider or narrower at its edge as the
 * others are.
 */
const RemoteAudioLayout = ({
  rail,
  mix,
  output,
  children,
}: IRemoteAudioLayoutProps) => {
  const { t } = useTranslation();
  return (
    <section className="remote-audio" aria-labelledby="remote-audio-title">
      <FixedStudioRail rail={rail} heading={t('tabs.share')}>
        {/* The page's name heads the rail, as every page with one names
            itself; the mix is the group it holds. */}
        <span className="studio-rail__lead" aria-hidden="true">
          {t('remoteAudio.group.mix')}
        </span>
        {mix}
        <div className="remote-audio__rail-foot">{output}</div>
      </FixedStudioRail>
      <div className="remote-audio__main">{children}</div>
    </section>
  );
};

export default RemoteAudioLayout;
