import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

const STEP = 0.25;
const SNAP_DISTANCE = 0.025;

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
  // Drag freely; only the small neighbourhood around a quarter is magnetic.
  // Keyboard nudges stay precise so every intermediate value remains reachable.
  const snap = (next: number) => {
    const nearest = Math.round(next / STEP) * STEP;
    return clamp(
      Math.abs(next - nearest) <= SNAP_DISTANCE + 1e-8
        ? nearest
        : Math.round(next * 100) / 100,
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.round((draft + 0.01) * 100) / 100;
        break;
      case 'PageUp':
        next = (Math.floor(draft / STEP + 1e-8) + 1) * STEP;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.round((draft - 0.01) * 100) / 100;
        break;
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
  const marks = [
    ...new Set([
      min,
      ...Array.from(
        { length: Math.floor(max / STEP) - Math.ceil(min / STEP) + 1 },
        (_, index) => (Math.ceil(min / STEP) + index) * STEP,
      ),
      max,
    ]),
  ];
  const labelStep = max - min > 2 ? 0.5 : 0.25;
  return (
    <div className="studio-setting lighting-slider">
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
      <div className="lighting-slider__marks" aria-hidden="true">
        {marks.map((mark) => (
          <span
            key={mark}
            className={`lighting-slider__mark${mark === min ? ' is-first' : ''}${mark === max ? ' is-last' : ''}`}
            style={{ left: `${((mark - min) / (max - min)) * 100}%` }}
          >
            {(mark === min ||
              mark === max ||
              (mark - min >= labelStep * 0.5 &&
                max - mark >= labelStep * 0.5 &&
                Math.abs(mark / labelStep - Math.round(mark / labelStep)) <
                  1e-8)) &&
              `${Math.round(mark * 100)}%`}
          </span>
        ))}
      </div>
    </div>
  );
}
