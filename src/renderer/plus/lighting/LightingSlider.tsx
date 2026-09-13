import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

const STEP = 0.25;

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
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  // Native steps start at min: a 10% minimum would give 35%, 60%…
  // Snap against zero instead and keep the exact endpoints accessible.
  const snap = (next: number) => {
    if (next >= max) {
      return max;
    }
    return clamp(Math.round(next / STEP) * STEP);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
      case 'PageUp':
        next = (Math.floor(draft / STEP + 1e-8) + 1) * STEP;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
      case 'PageDown':
        next = (Math.ceil(draft / STEP - 1e-8) - 1) * STEP;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    setDraft(clamp(next));
  };
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
        step="any"
        value={draft}
        aria-valuetext={`${Math.round(draft * 100)}%`}
        style={
          {
            '--fill': `${((draft - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
        onChange={(event) => setDraft(snap(Number(event.currentTarget.value)))}
        onKeyDown={onKeyDown}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </div>
  );
}
