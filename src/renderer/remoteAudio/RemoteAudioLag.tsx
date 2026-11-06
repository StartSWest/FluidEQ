/* FluidEQ — GPL-3.0-or-later */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ILanRemoteAudioNetworkStats } from '../../common/remoteAudio';
import { useTranslation } from '../utils/I18nContext';
import useSmoothFrames from '../utils/useSmoothFrames';

const RemoteAudioLag = ({
  stats,
  incoming,
  outgoing,
}: {
  stats?: ILanRemoteAudioNetworkStats;
  incoming: boolean;
  outgoing: boolean;
}) => {
  const { t, locale } = useTranslation();
  const element = useRef<HTMLDivElement>(null);
  const lastReport = useRef(-Infinity);
  const [fresh, setFresh] = useState(false);
  const measured =
    stats?.incomingLagMs !== undefined || stats?.outgoingLagMs !== undefined;
  const number = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );
  // Only a visible readout checks freshness, at one check a second. It
  // stops after expiring; no network polling or audio work is scheduled.
  const kick = useSmoothFrames(
    () => {
      if (performance.now() - lastReport.current > 3_000) {
        setFresh(false);
        return false;
      }
      return true;
    },
    {
      isEnabled: measured,
      target: element,
      minFrameMs: () => 1_000,
    },
  );
  useEffect(() => {
    if (stats && measured) {
      lastReport.current = performance.now();
      setFresh(true);
      kick();
    } else {
      setFresh(false);
    }
  }, [stats, measured, kick]);
  const format = (value: number | undefined, enabled: boolean) =>
    fresh &&
    enabled &&
    value !== undefined &&
    Number.isFinite(value) &&
    value >= 0
      ? t('remoteAudio.lag.value', {
          milliseconds: number.format(value),
        })
      : '—';
  return (
    <div
      ref={element}
      className="remote-audio__lag"
      title={t('remoteAudio.lag.hint')}
    >
      <span>
        {t('remoteAudio.lag.in')}{' '}
        <strong>{format(stats?.incomingLagMs, incoming)}</strong>
      </span>
      <span>
        {t('remoteAudio.lag.out')}{' '}
        <strong>{format(stats?.outgoingLagMs, outgoing)}</strong>
      </span>
    </div>
  );
};

export default RemoteAudioLag;
