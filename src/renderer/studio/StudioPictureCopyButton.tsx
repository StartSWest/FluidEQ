import { useEffect, useRef } from 'react';
import Glyph from '../community/Glyph';
import type { IPictureSource } from './pictureClipboard';
import usePictureCopy from './usePictureCopy';

/** Whether a key press is the copy shortcut, Ctrl+C or ⌘C, and only that. */
const isCopyKey = (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === 'c';

/**
 * The viewer's Copy, beside its Save (Ivan, 2026-11-09: "I need to be able to
 * copy image from previews too"), and Ctrl+C while the viewer is open: the
 * picture shown, at its own full size.
 *
 * The shortcut gives way to a selection, which is what Ctrl+C copies
 * everywhere else: a name selected in the head is copied as text.
 */
export default function StudioPictureCopyButton({
  source,
}: {
  source: IPictureSource | undefined;
}) {
  const { copy, label, copying } = usePictureCopy();
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const copyingRef = useRef(copying);
  copyingRef.current = copying;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shown = sourceRef.current;
      if (
        !shown ||
        copyingRef.current ||
        !isCopyKey(event) ||
        event.defaultPrevented ||
        (window.getSelection()?.toString() ?? '') !== ''
      ) {
        return;
      }
      event.preventDefault();
      copy(shown);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [copy]);

  return (
    <button
      type="button"
      className={`button small subtle${copying ? ' is-running' : ''}`}
      aria-busy={copying}
      disabled={!source}
      onClick={() => {
        if (source && !copying) {
          copy(source);
        }
      }}
    >
      <Glyph name="copy" />
      {label}
    </button>
  );
}
