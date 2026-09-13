import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { inspectOfficialScene } from '../studio/studioStore';
import { setGalleryNotice } from './galleryActions';
import { openPlusPlace } from './plusNavigation';

interface ISceneInspectButtonProps {
  /** One of FluidEQ's own scenes; the main process checks it is. */
  sceneId: string;
}

/**
 * "Open in Studio" on one of FluidEQ's own scenes: its code and settings as a
 * Studio project, to see how it is made and take ideas from.
 *
 * Under the scene's own actions rather than among them: it is a way of
 * learning from the scene, not of keeping it, and the line under it says the
 * project it makes is one to look inside, never one to publish. The Studio
 * opens on that project as soon as it is made.
 */
export default function SceneInspectButton({
  sceneId,
}: ISceneInspectButtonProps) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);

  const open = () => {
    if (opening) {
      return;
    }
    setOpening(true);
    const failed = (key: TranslationKey) =>
      setGalleryNotice({ ok: false, key });
    inspectOfficialScene(sceneId)
      .then((outcome) => {
        if (outcome === 'opened' || outcome === 'present') {
          openPlusPlace('studio');
        } else {
          failed(
            outcome === 'unavailable'
              ? 'plus.inspect.unavailable'
              : 'plus.inspect.failed',
          );
        }
        return undefined;
      })
      .catch(() => failed('plus.inspect.failed'))
      .finally(() => setOpening(false));
  };

  return (
    <div className="gallery-scene__inspect">
      <button
        type="button"
        className={`button small subtle${opening ? ' is-running' : ''}`}
        aria-busy={opening}
        disabled={opening}
        onClick={open}
      >
        <Glyph name="studio" />
        {t('plus.inspect.open')}
      </button>
      <p className="gallery-scene__inspect-hint">{t('plus.inspect.hint')}</p>
    </div>
  );
}
