import { useEffect, useId, useState, type CSSProperties } from 'react';

export default function LightingSlider({
  label,
  value,
  min = 0,
  max = 1,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };
  return (
    <div className="studio-setting">
      <div className="studio-setting__head">
        <label className="studio-setting__label" htmlFor={id}>
          {label}
        </label>
        <output className="studio-setting__value" htmlFor={id}>
          {Math.round(draft * 100)}%
        </output>
      </div>
      <input
        id={id}
        className="studio-slider"
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={draft}
        style={
          {
            '--fill': `${((draft - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
        onChange={(event) => setDraft(Number(event.currentTarget.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </div>
  );
}
