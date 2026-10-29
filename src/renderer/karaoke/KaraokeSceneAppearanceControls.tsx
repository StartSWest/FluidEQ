/* FluidEQ — GPL-3.0-or-later */
import { useId } from 'react';
import BackdropAppearanceControls from '../graph/BackdropAppearanceControls';
import { useTranslation } from '../utils/I18nContext';
import { MAX_OVERLAY_BLUR } from '../utils/graphOverlay';
import {
  setKaraokeSceneOpacity,
  setKaraokeSceneBlur,
  useKaraokeSceneAppearance,
} from './karaokeSceneAppearance';

/** Only this picture changes: the separate graph and the cover keep their settings. */
export default function KaraokeSceneAppearanceControls() {
  const id = useId();
  const { t } = useTranslation();
  const appearance = useKaraokeSceneAppearance();
  return (
    <div role="group" aria-label={t('tabs.karaoke')}>
      <BackdropAppearanceControls
        idPrefix={id}
        transparencyHint={t('graph.seeThrough')}
        opacity={appearance.opacity}
        onChangeOpacity={setKaraokeSceneOpacity}
        blur={appearance.blur}
        onChangeBlur={setKaraokeSceneBlur}
        minOpacity={0}
        maxBlur={MAX_OVERLAY_BLUR}
      />
    </div>
  );
}
