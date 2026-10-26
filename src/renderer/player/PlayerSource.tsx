/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n/en';
import type { TPlaybackOwner } from '../audio/playbackOwner';
import type { ITransportSource } from '../audio/transportSource';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import type { TPlayerPage } from './PlayerMarkMenu';
import { sourceLabel } from './playerText';

/**
 * Each source by the tab strip's glyph for it (`PlayerMarkMenu`), and the
 * page its line opens, named by that page's tab. The machine's own audio
 * belongs to no page, so its line opens nothing.
 */
const SOURCE_NODES: Record<
  TPlaybackOwner,
  { icon: MenuIconName; page?: TPlayerPage; pageKey?: TranslationKey }
> = {
  library: { icon: 'album', page: 'library', pageKey: 'tabs.library' },
  media: { icon: 'video', page: 'video', pageKey: 'tabs.media' },
  karaoke: { icon: 'microphone', page: 'karaoke', pageKey: 'tabs.karaoke' },
  remote: { icon: 'waveform', page: 'share', pageKey: 'tabs.share' },
  system: { icon: 'monitor' },
};

interface IPlayerSourceProps {
  source: Pick<ITransportSource, 'owner' | 'origin' | 'delayMs'>;
  onOpenPage: (page: TPlayerPage) => void;
}

/**
 * Where the song is coming from, over its title (Ivan, 2026-10-25, the one
 * amp): the source's glyph and its name in small capitals — another
 * computer by its own name. A press opens the source's page in the full app.
 */
const PlayerSource = ({ source, onOpenPage }: IPlayerSourceProps) => {
  const { t } = useTranslation();
  const node = SOURCE_NODES[source.owner];
  const label = sourceLabel(source, t);
  const face = (
    <>
      <MenuIcon name={node.icon} className="player-source__icon" />
      <span className="player-source__name">{label}</span>
    </>
  );
  const { page, pageKey } = node;
  if (page && pageKey) {
    return (
      <button
        type="button"
        className="player-source"
        title={t('player.path.open', { name: t(pageKey) })}
        onClick={() => onOpenPage(page)}
      >
        {face}
      </button>
    );
  }
  return (
    <span className="player-source" title={label}>
      {face}
    </span>
  );
};

export default PlayerSource;
