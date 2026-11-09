import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from '../utils/I18nContext';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { copyPicture, type IPictureSource } from './pictureClipboard';
import '../styles/StudioPictureCopy.scss';

type TCopyState = 'idle' | 'copying' | 'copied' | 'failed';

/**
 * Copying a picture, and the word that says how it went: "Copy image" until
 * pressed, "Copying…" while its PNG is made — up to a second for a large
 * piece, so the press shows at once — then "Copied" — or "Could not copy" — for its moment, as the
 * share card says it (`ShareScoreCard.tsx`). How long the word stays is the
 * hold of its own animation (`studio-picture-copied`), and its end is what
 * puts the label back; never a timer.
 *
 * `onSettled` hears the word come down: a menu closes then, after it has
 * shown what happened rather than before.
 */
export default function usePictureCopy(onSettled?: () => void) {
  const { t } = useTranslation();
  const [state, setState] = useState<TCopyState>('idle');
  // A second copy while the word is up starts its moment again.
  const [seq, setSeq] = useState(0);

  const copy = useCallback((source: IPictureSource) => {
    setState('copying');
    copyPicture(source)
      .then(() => setState('copied'))
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- the one trace a refused clipboard leaves before the word on the button replaces it
        console.error('A picture could not be copied:', error);
        setState('failed');
      })
      .finally(() => setSeq((value) => value + 1));
  }, []);

  // A menu closed while its word was still up opens on its own label again.
  const reset = useCallback(() => setState('idle'), []);

  let label: ReactNode = t('studio.picture.copy');
  if (state === 'copying') {
    label = t('studio.picture.copying');
  } else if (state !== 'idle') {
    label = (
      <span
        key={seq}
        className="studio-picture-copied"
        role="status"
        onAnimationEnd={(event) => {
          if (isOwnAnimationEnd(event, 'studio-picture-copied')) {
            setState('idle');
            onSettled?.();
          }
        }}
      >
        {t(
          state === 'copied'
            ? 'studio.picture.copied'
            : 'studio.picture.copyFailed',
        )}
      </span>
    );
  }

  return { copy, label, reset, copying: state === 'copying' };
}
