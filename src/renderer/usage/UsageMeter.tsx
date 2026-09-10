import { useEffect, useRef } from 'react';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { accrueFromFrame, FLUSH_AFTER_SECONDS } from './usageAccrual';

/**
 * Counts listening. Renders nothing.
 *
 * Sits inside the live-audio provider and wakes with every frame, like the
 * canvas does; while the spectrum has points, music is playing, and the gap
 * since the previous frame is added up. Once a minute's worth has accrued it
 * is handed to the main process, which keeps the day's tally on disk — and
 * again whenever the window is hidden or this unmounts, so a session that ends
 * mid-minute loses at most the minute.
 *
 * Whether any of it leaves the machine is decided elsewhere, by the person, in
 * the Account panel. This only counts.
 */
export default function UsageMeter() {
  const { points } = useLiveAudioFrame();
  const playing = points.length > 0;
  const previousAtRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef(0);

  useEffect(() => {
    const now = performance.now();
    pendingRef.current += accrueFromFrame(previousAtRef.current, now, playing);
    previousAtRef.current = now;
    if (pendingRef.current >= FLUSH_AFTER_SECONDS) {
      const seconds = pendingRef.current;
      pendingRef.current = 0;
      window.electron?.ipcRenderer
        ?.usageAccrue?.(seconds)
        .catch(() => undefined);
    }
  }, [points, playing]);

  useEffect(() => {
    const flush = () => {
      if (pendingRef.current <= 0) {
        return;
      }
      const seconds = pendingRef.current;
      pendingRef.current = 0;
      window.electron?.ipcRenderer
        ?.usageAccrue?.(seconds)
        .catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.hidden) {
        flush();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, []);

  return null;
}
