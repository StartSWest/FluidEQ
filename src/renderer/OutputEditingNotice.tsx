/* FluidEQ — GPL-3.0-or-later */
import { useCallback, useRef } from 'react';
import OutputEditButton from './OutputEditButton';
import OutputProfileSelect from './OutputProfileSelect';
import { useFluidEqShell } from './utils/FluidEqContext';
import { useOutputEditor } from './utils/outputEditor';
import { useTranslation } from './utils/I18nContext';

const TABBABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Where the keyboard goes when the notice leaves: the first control from
 * `anchor` on — what followed the notice — so focus does not fall to the
 * page's start when "Edit main", which had it, disappears with the notice.
 */
const focusFrom = (anchor: Element | null) => {
  if (!anchor?.isConnected) {
    return;
  }
  const next = Array.from(
    document.querySelectorAll<HTMLElement>(TABBABLE),
  ).find(
    (element) =>
      (anchor.contains(element) ||
        // eslint-disable-next-line no-bitwise -- a DOM position mask
        (anchor.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0) &&
      element.closest('[inert]') === null,
  );
  next?.focus();
};

/** Keep the edited output visible even when the sound panel is folded. */
const OutputEditingNotice = () => {
  const { editor, main } = useOutputEditor();
  const { t } = useTranslation();
  const { refreshState } = useFluidEqShell();
  // What follows the notice, noted while it is there to ask.
  const after = useRef<Element | null>(null);
  const noteAfter = useCallback((notice: HTMLDivElement | null) => {
    if (notice) {
      after.current = notice.nextElementSibling ?? notice.parentElement;
    }
  }, []);
  if (!editor || editor.device.id === main?.id) {
    return null;
  }
  // Only the words are a live region: the notice also holds a profile pick
  // and a button, and as the region itself every pick read all of it again.
  return (
    <div className="device-profiles__editing" ref={noteAfter}>
      <span role="status">
        {t('extraOutput.editingOutput', { device: editor.device.name })}
      </span>
      <div className="device-profiles__editingProfile">
        <span aria-hidden="true">·</span>
        <OutputProfileSelect
          key={editor.device.id}
          device={editor.device}
          onChanged={refreshState}
        />
      </div>
      {main && (
        <span className="device-profiles__editMain">
          <span aria-hidden="true">·</span>
          <OutputEditButton
            device={main}
            label={t('extraOutput.editMain')}
            onDone={() => focusFrom(after.current)}
          />
        </span>
      )}
    </div>
  );
};
export default OutputEditingNotice;
