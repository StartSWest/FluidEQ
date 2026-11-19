/* FluidEQ — GPL-3.0-or-later */
import type { ReactNode } from 'react';
import type { ILibraryRailWidth } from '../library/LibraryRailSplitter';
import { useTranslation } from '../utils/I18nContext';
import StudioRail from '../widgets/StudioRail';
import '../styles/RemoteAudio.scss';

/**
 * Where the mix rail's pin and its dragged width are remembered (`useRailPinned`,
 * `useRailWidth`): a pin and a width of the page's own.
 */
export const SHARE_RAIL_PINNED_KEY = 'fluideq.shareRailPinned';

export const SHARE_RAIL_WIDTH_KEY = 'fluideq.shareRailWidth';

interface IRemoteAudioLayoutProps {
  /** The rail's width and its drag (`useRailWidth`). */
  rail: ILibraryRailWidth;
  isPinned: boolean;
  onPinnedChange: (next: boolean) => void;
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
 * One card, the page's: the mix down the studio rail (`StudioRail`, the one
 * the DSP page stands on - the Library's hairline, splitter and width memory
 * with the Scenes tab's pin), and the group beside it on the card's own
 * floor. The mix was a card of its own at the right of the group, and the
 * group a card with a framed header; both are gone.
 *
 * Folded, the rail keeps its column of mute buttons - each fader's own,
 * leading its row - and lets every word go (`studio-rail__word`), so each
 * source's speaker stays a press away and the faders open over the group
 * while the pointer or the keyboard is on the rail.
 */
const RemoteAudioLayout = ({
  rail,
  isPinned,
  onPinnedChange,
  mix,
  output,
  children,
}: IRemoteAudioLayoutProps) => {
  const { t } = useTranslation();
  return (
    <section className="remote-audio" aria-labelledby="remote-audio-title">
      <StudioRail
        rail={rail}
        isPinned={isPinned}
        onPinnedChange={onPinnedChange}
        heading={t('remoteAudio.group.mix')}
      >
        {mix}
        <div className="remote-audio__rail-foot studio-rail__word">
          {output}
        </div>
      </StudioRail>
      <div className="remote-audio__main">{children}</div>
    </section>
  );
};

export default RemoteAudioLayout;
