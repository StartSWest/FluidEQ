/* FluidEQ — GPL-3.0-or-later */
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import DialogFrame from '../components/DialogFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import RemoteAudioLinkForm, {
  type IRemoteAudioLinkFormProps,
} from './RemoteAudioLinkForm';

/** Pairing stays reachable from the header even when the group grows.
 * The form and modal behavior are the same controls used elsewhere in the app. */
export default function RemoteAudioLinkDialog({
  deviceName,
  code,
  status,
  pasteError,
  onLink,
  onClose,
}: IRemoteAudioLinkFormProps & { onClose(): void }) {
  const { t } = useTranslation();
  const id = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useModalKeys(surfaceRef, inputRef, { busy: false, onCancel: onClose });

  return createPortal(
    <div
      className="remote-audio__add-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="remote-audio__add-dialog"
        icon={<MenuIcon name="monitor" />}
        title={t('remoteAudio.group.add')}
        titleId={`${id}-title`}
        description={t('remoteAudio.group.hint')}
        closeLabel={t('support.close')}
        onClose={onClose}
      >
        <RemoteAudioLinkForm
          deviceName={deviceName}
          code={code}
          status={status}
          pasteError={pasteError}
          inputRef={inputRef}
          onLink={async (value) => {
            const linked = await onLink(value);
            if (linked) {
              onClose();
            }
            return linked;
          }}
        />
      </DialogFrame>
    </div>,
    document.body,
  );
}
