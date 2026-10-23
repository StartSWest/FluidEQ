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
import { readOutputEditor, useOutputEditor } from './outputEditor';

export default function useCurvePhase() {
  const state = useFluidEqContext();
  const { editor } = useOutputEditor();
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
    const target = readOutputEditor().editor;
    try {
      const next = await getCurveComparison();
      if (
        mounted.current &&
        !saving.current &&
        current === revision.current &&
        target === readOutputEditor().editor
      ) {
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
    state.filters,
    state.graphicEq,
    state.isFlat,
    state.eqFormat,
    state.eqMode,
    state.mainBandQ,
    state.eqBandQ,
    state.driver,
    state.headphone,
    state.voicing,
    state.smartEq,
    state.bypassed,
    state.curveEqMode,
    state.curveBandQ,
    state.curveSmoothing,
    editor,
  ]);

  const select = async (variant: TCurveComparison, scope: TPhaseScope) => {
    const target = readOutputEditor().editor;
    saving.current = true;
    revision.current += 1;
    try {
      const applied = await setCurveComparison(variant, scope);
      if (mounted.current && target === readOutputEditor().editor) {
        setStatus(applied);
      }
    } finally {
      saving.current = false;
      await refresh();
    }
  };

  return { status, select };
}
