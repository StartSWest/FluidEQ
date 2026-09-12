import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ICurveComparisonStatus,
  TCurveComparison,
  TPhaseScope,
} from '../../common/curveComparison';
import { ErrorDescription } from '../../common/errors';
import { useFluidEqContext } from './FluidEqContext';
import { getCurveComparison, setCurveComparison } from './curveComparisonApi';
import { subscribeAudioEngineChanged } from './audioEngineEvents';

export default function useCurvePhase() {
  const state = useFluidEqContext();
  const [status, setStatus] = useState<ICurveComparisonStatus>();
  const mounted = useRef(true);
  const saving = useRef(false);
  const revision = useRef(0);
  const { setGlobalError } = state;
  const refresh = useCallback(async () => {
    if (saving.current) {
      return;
    }
    revision.current += 1;
    const { current } = revision;
    try {
      const next = await getCurveComparison();
      if (mounted.current && !saving.current && current === revision.current) {
        setStatus(next);
      }
    } catch (error) {
      if (mounted.current && current === revision.current) {
        setGlobalError(error as ErrorDescription);
      }
    }
  }, [setGlobalError]);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeAudioEngineChanged(refresh);
    return () => {
      mounted.current = false;
      revision.current += 1;
      unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [
    refresh,
    state.isEnabled,
    state.driver,
    state.headphone,
    state.voicing,
    state.smartEq,
    state.bypassed,
    state.curveEqMode,
    state.curveBandQ,
    state.curveSmoothing,
  ]);

  const select = async (variant: TCurveComparison, scope: TPhaseScope) => {
    saving.current = true;
    revision.current += 1;
    try {
      const applied = await setCurveComparison(variant, scope);
      if (mounted.current) {
        setStatus(applied);
      }
    } finally {
      saving.current = false;
      await refresh();
    }
  };

  return { status, select };
}
