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

// Two arrows chasing each other round: the looks coming back one after another.
const CYCLE_ICON = (
  <svg className="graph-auto-cycle__icon" viewBox="0 0 16 16" aria-hidden>
    <path d="M13.2 7.2a5.2 5.2 0 0 0-9.3-2.6" />
    <path d="M3.4 1.9v2.9h2.9" />
    <path d="M2.8 8.8a5.2 5.2 0 0 0 9.3 2.6" />
    <path d="M12.6 14.1v-2.9H9.7" />
  </svg>
);

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
      className={`graph-auto-cycle${seconds > 0 ? ' is-on' : ''}`}
      menuClassName="graph-auto-cycle-menu"
      leading={CYCLE_ICON}
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
