import { useMemo, useState } from 'react';
import Dropdown from '../widgets/Dropdown';
import { useTranslation } from '../utils/I18nContext';
import {
  GRAPH_AUTO_CYCLE_INTERVALS,
  readGraphAutoCycle,
  saveGraphAutoCycle,
  useGraphAutoCycle,
} from '../utils/graphAutoCycle';

interface IGraphAutoCycleProps {
  selectedLookId: string;
  isWaveHidden: boolean;
  isEditing: boolean;
}

const GraphAutoCycle = ({
  selectedLookId,
  isWaveHidden,
  isEditing,
}: IGraphAutoCycleProps) => {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(readGraphAutoCycle);
  useGraphAutoCycle(seconds, isWaveHidden || isEditing, selectedLookId);
  const options = useMemo(
    () =>
      GRAPH_AUTO_CYCLE_INTERVALS.map((value) => {
        const label =
          value === 0
            ? t('graph.autoSwitch.off')
            : t('graph.autoSwitch.every', { seconds: value });
        return { value: String(value), label, display: label };
      }),
    [t],
  );
  return (
    <Dropdown
      name={t('graph.autoSwitch.label')}
      menuClassName="graph-auto-cycle-menu"
      options={options}
      value={String(seconds)}
      isDisabled={isWaveHidden}
      placement="down"
      handleChange={(value) => {
        const next = Number(value);
        setSeconds(next);
        saveGraphAutoCycle(next);
      }}
    />
  );
};

export default GraphAutoCycle;
