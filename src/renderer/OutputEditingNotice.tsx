/* FluidEQ — GPL-3.0-or-later */
import OutputEditButton from './OutputEditButton';
import OutputProfileSelect from './OutputProfileSelect';
import { useFluidEqShell } from './utils/FluidEqContext';
import { useOutputEditor } from './utils/outputEditor';
import { useTranslation } from './utils/I18nContext';

/** Keep the edited output visible even when the sound panel is folded. */
const OutputEditingNotice = () => {
  const { editor, main } = useOutputEditor();
  const { t } = useTranslation();
  const { refreshState } = useFluidEqShell();
  if (!editor || editor.device.id === main?.id) {
    return null;
  }
  return (
    <div className="device-profiles__editing" role="status">
      <span>
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
      {main && editor.device.id !== main.id && (
        <span className="device-profiles__editMain">
          <span aria-hidden="true">·</span>
          <OutputEditButton device={main} label={t('extraOutput.editMain')} />
        </span>
      )}
    </div>
  );
};
export default OutputEditingNotice;
