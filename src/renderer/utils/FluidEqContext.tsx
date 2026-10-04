/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AutoEqFormat,
  getDefaultState,
  IGraphicEqPoint,
  IConvolutionProfile,
  IEqImportReference,
  IState,
  OUTPUT_STATE_CHANGED_EVENT,
  TApoLayer,
  IHeadphoneSettings,
} from '../../common/constants';
import { DEFAULT_VOICING, IVoicingSettings } from '../../common/voicing';
import { DEFAULT_DRIVER, IDriverSettings } from '../../common/driver';
import { ISmartEqSettings } from '../../common/smartEq';
import type { ITone } from '../../common/tone';
import {
  ErrorCode,
  ErrorDescription,
  getErrorDescription,
  isBlockingError as isBlockingErrorCode,
  isErrorDescription,
} from '../../common/errors';
import { reportError } from './logger';
import ChannelEnum from '../../common/channels';

import { SelectionMode, nextBandSelection } from '../../common/bandSelection';
import { getEqualizerState } from './equalizerApi';
import { adoptOutputDsp, setDspRackGate } from '../dsp/store';
import { updateOutputEditor } from './outputEditor';
import { IBandRevealBand, planBandReveal, revealBands } from './bandReveal';
import {
  FilterAction,
  FilterActionEnum,
  IFluidEqContext,
  IFluidEqLayers,
  IFluidEqShell,
  IRefreshStateOptions,
} from './fluidEqContextTypes';
import filterReducer from './filterReducer';

export { FilterActionEnum } from './fluidEqContextTypes';
export type {
  FilterAction,
  IFluidEqContext,
  IFluidEqLayers,
  IFluidEqShell,
  IRefreshStateOptions,
} from './fluidEqContextTypes';

const FluidEqContext = createContext<IFluidEqContext | undefined>(undefined);

const FluidEqShellContext = createContext<IFluidEqShell | undefined>(undefined);
const FluidEqLayersContext = createContext<IFluidEqLayers | undefined>(
  undefined,
);

export interface IFluidEqProviderWrapperProps {
  value: IFluidEqContext;
  children: ReactNode;
}

interface IFluidEqProviderProps {
  children: ReactNode;
}

/**
 * All three contexts from one value — see `IFluidEqShell` for why three.
 *
 * The narrow two are memoised field by field, so they keep their identity for
 * as long as what they carry does, however often `value` itself is rebuilt.
 * Tests hand this a plain object; the provider below hands it its own.
 */
export const FluidEqProviderWrapper = ({
  value,
  children,
}: IFluidEqProviderWrapperProps) => {
  const {
    activeDeviceId,
    isLoading,
    globalError,
    isBlockingError,
    isEngineUsable,
    isEnabled,
    isAutoPreAmpOn,
    isGraphViewOn,
    isCaseSensitiveFs,
    performHealthCheck,
    refreshState,
    setGlobalError,
    setIsEnabled,
    setAutoPreAmpOn,
    setGraphViewOn,
    setPreAmp,
    setConvolution,
    setDriver,
    setVoicing,
    setSmartEq,
    setTone,
    setHeadphone,
    setSelectedFilterId,
    setSelectedFilterIds,
    setHoveredFilterId,
    dispatchFilter,
    getBandSetGeneration,
    convolution,
    headset,
    headsetTarget,
    headsetSource,
    voicing,
    driver,
    smartEq,
    tone,
    headphone,
    customFx,
    bypassed,
    isEqDoubleOn,
    eqMode,
    eqBandDesign,
    curveEqMode,
    mainBandQ,
    eqBandQ,
    curveBandQ,
    curveSmoothing,
    eqCuts,
    eqFormat,
    graphicEq,
    eqImport,
    isFlat,
    filters,
  } = value;
  const bandCount = Object.keys(filters ?? {}).length;

  const shell = useMemo<IFluidEqShell>(
    () => ({
      activeDeviceId,
      isLoading,
      globalError,
      isBlockingError,
      isEngineUsable,
      isEnabled,
      isAutoPreAmpOn,
      isGraphViewOn,
      isCaseSensitiveFs,
      performHealthCheck,
      refreshState,
      setGlobalError,
      setIsEnabled,
      setAutoPreAmpOn,
      setGraphViewOn,
      setPreAmp,
      setConvolution,
      setDriver,
      setVoicing,
      setSmartEq,
      setTone,
      setHeadphone,
      setSelectedFilterId,
      setSelectedFilterIds,
      setHoveredFilterId,
      dispatchFilter,
      getBandSetGeneration,
    }),
    [
      activeDeviceId,
      isLoading,
      globalError,
      isBlockingError,
      isEngineUsable,
      isEnabled,
      isAutoPreAmpOn,
      isGraphViewOn,
      isCaseSensitiveFs,
      performHealthCheck,
      refreshState,
      setGlobalError,
      setIsEnabled,
      setAutoPreAmpOn,
      setGraphViewOn,
      setPreAmp,
      setConvolution,
      setDriver,
      setVoicing,
      setSmartEq,
      setTone,
      setHeadphone,
      setSelectedFilterId,
      setSelectedFilterIds,
      setHoveredFilterId,
      dispatchFilter,
      getBandSetGeneration,
    ],
  );

  const layers = useMemo<IFluidEqLayers>(
    () => ({
      ...shell,
      convolution,
      headset,
      headsetTarget,
      headsetSource,
      voicing,
      driver,
      smartEq,
      tone,
      headphone,
      customFx,
      bypassed,
      isEqDoubleOn,
      eqMode,
      eqBandDesign,
      curveEqMode,
      mainBandQ,
      eqBandQ,
      curveBandQ,
      curveSmoothing,
      eqCuts,
      eqFormat,
      graphicEq,
      eqImport,
      isFlat,
      bandCount,
    }),
    [
      shell,
      convolution,
      headset,
      headsetTarget,
      headsetSource,
      voicing,
      driver,
      smartEq,
      tone,
      headphone,
      customFx,
      bypassed,
      isEqDoubleOn,
      eqMode,
      eqBandDesign,
      curveEqMode,
      mainBandQ,
      eqBandQ,
      curveBandQ,
      curveSmoothing,
      eqCuts,
      eqFormat,
      graphicEq,
      eqImport,
      isFlat,
      bandCount,
    ],
  );

  return (
    <FluidEqShellContext.Provider value={shell}>
      <FluidEqLayersContext.Provider value={layers}>
        <FluidEqContext.Provider value={value}>
          {children}
        </FluidEqContext.Provider>
      </FluidEqLayersContext.Provider>
    </FluidEqShellContext.Provider>
  );
};

export const FluidEqProvider = ({ children }: IFluidEqProviderProps) => {
  const [globalError, storeGlobalError] = useState<
    ErrorDescription | undefined
  >();
  /**
   * Every caller hands in what it caught, cast to a description. A plain
   * Error thrown on the way — a TypeError in a handler — reached the banner
   * with no code and no words, and drew it with an empty title. Anything that
   * is not one of the codes' descriptions shows as the general failure, and
   * goes into the log whole.
   */
  const setGlobalError = useCallback((next?: ErrorDescription) => {
    if (next === undefined || isErrorDescription(next)) {
      storeGlobalError(next);
      return;
    }
    reportError('An unexpected failure reached the error banner', next);
    storeGlobalError(getErrorDescription(ErrorCode.FAILURE));
  }, []);

  // Once, for the initial values below: it mints fifteen band ids and works out
  // their Q, and was being run again on every render — every frame of a drag.
  const [DEFAULT_STATE] = useState(getDefaultState);

  const [isEnabled, setIsEnabled] = useState<boolean>(DEFAULT_STATE.isEnabled);
  const [isEqDoubleOn, setIsEqDoubleOn] = useState(false);
  const [eqMode, setEqMode] = useState<IState['eqMode']>();
  const [eqBandDesign, setEqBandDesign] = useState<IState['eqBandDesign']>();
  const [curveEqMode, setCurveEqMode] = useState<IState['curveEqMode']>();
  const [mainBandQ, setMainBandQ] = useState<IState['mainBandQ']>();
  const [eqBandQ, setEqBandQ] = useState<IState['eqBandQ']>();
  const [curveBandQ, setCurveBandQ] = useState<IState['curveBandQ']>();
  const [curveSmoothing, setCurveSmoothing] =
    useState<IState['curveSmoothing']>();
  const [eqCuts, setEqCuts] = useState<IState['eqCuts']>();
  const [isAutoPreAmpOn, setAutoPreAmpOn] = useState<boolean>(
    DEFAULT_STATE.isAutoPreAmpOn,
  );
  const [isGraphViewOn, setIsGraphViewOn] = useState<boolean>(
    DEFAULT_STATE.isGraphViewOn,
  );
  const [isCaseSensitiveFs, setIsCaseSensitiveFs] = useState<boolean>(
    DEFAULT_STATE.isCaseSensitiveFs,
  );
  const [preAmp, setPreAmp] = useState<number>(DEFAULT_STATE.preAmp);
  const [isFlat, setIsFlat] = useState<boolean | undefined>(
    DEFAULT_STATE.isFlat,
  );
  const [eqFormat, setEqFormat] = useState<AutoEqFormat | undefined>(
    DEFAULT_STATE.eqFormat,
  );
  const [graphicEq, setGraphicEq] = useState<IGraphicEqPoint[] | undefined>(
    DEFAULT_STATE.graphicEq,
  );
  const [eqImport, setEqImport] = useState<IEqImportReference | undefined>(
    DEFAULT_STATE.eqImport,
  );
  const [voicing, setVoicing] = useState<IVoicingSettings>(
    DEFAULT_STATE.voicing ?? DEFAULT_VOICING,
  );
  const [driver, setDriver] = useState<IDriverSettings>(
    DEFAULT_STATE.driver ?? DEFAULT_DRIVER,
  );
  const [smartEq, setSmartEq] = useState<ISmartEqSettings | undefined>(
    DEFAULT_STATE.smartEq,
  );
  const [tone, setTone] = useState<ITone | undefined>(DEFAULT_STATE.tone);
  const [headphone, setHeadphone] = useState<IHeadphoneSettings | undefined>(
    DEFAULT_STATE.headphone,
  );
  const [customFx, setCustomFx] = useState(DEFAULT_STATE.customFx);
  const [bypassed, setBypassed] = useState<TApoLayer[]>(
    DEFAULT_STATE.bypassed ?? [],
  );
  const [convolution, setConvolution] = useState<
    IConvolutionProfile | undefined
  >(DEFAULT_STATE.convolution);
  const [headset, setHeadset] = useState<string | undefined>(
    DEFAULT_STATE.headset,
  );
  const [headsetTarget, setHeadsetTarget] = useState<string | undefined>(
    DEFAULT_STATE.headsetTarget,
  );
  const [headsetSource, setHeadsetSource] = useState<string | undefined>(
    DEFAULT_STATE.headsetSource,
  );
  const [selectedFilterId, setSelectedFilterIdState] = useState<string>('');
  const [selectedFilterIds, setSelectedFilterIdsState] = useState<string[]>([]);
  const [hoveredFilterId, setHoveredFilterId] = useState<string>('');
  const [filters, applyFilterAction] = useReducer(
    filterReducer,
    DEFAULT_STATE.filters,
  );

  // Bumped by the three actions that change which bands exist, as opposed to
  // moving a value on a band that is still there. Wrapping the reducer's own
  // dispatch is what makes the count unmissable: every caller in the app
  // already goes through the context to reach the bands.
  const bandSetGenerationRef = useRef(0);
  const getBandSetGeneration = useCallback(
    () => bandSetGenerationRef.current,
    [],
  );

  // INIT alone, where the count above also takes in adding and deleting a
  // band. A reveal has to tell those two apart: replaced means some newer
  // tuning owns the editor and the rest of this one must never be asserted
  // over it, while added or deleted means this tuning is still the one on
  // screen and the bands the animation never reached are still at 0 dB.
  const bandSetReplacementRef = useRef(0);
  // The same count, for what draws from it (`IFluidEqContext`).
  const [bandSetReplacement, setBandSetReplacement] = useState(0);

  // Set only while a reveal is drawing. Anything that reaches the context
  // through dispatchFilter while it is — the reveal's own frames go straight
  // to the reducer — is a band the user moved, and they moved it with the main
  // process listening. Painting the reference over it would leave the editor
  // showing a gain Equalizer APO is not playing.
  const revealEditedIdsRef = useRef<Set<string> | undefined>(undefined);

  const dispatchFilter = useCallback((action: FilterAction) => {
    if (action.type === FilterActionEnum.CLEAR_GAINS) {
      setIsFlat(true);
    } else if (
      action.type !== FilterActionEnum.INIT &&
      action.type !== FilterActionEnum.GAINS
    ) {
      // Main marks every deliberate band edit as a shaped EQ, including
      // gainless pass/notch types whose gain remains 0 dB. Carry the same fact
      // locally so the applied-layer chip does not depend on gain alone.
      setIsFlat(false);
    }
    if (
      action.type === FilterActionEnum.INIT ||
      action.type === FilterActionEnum.ADD ||
      action.type === FilterActionEnum.REMOVE
    ) {
      bandSetGenerationRef.current += 1;
    }
    if (action.type === FilterActionEnum.INIT) {
      bandSetReplacementRef.current += 1;
      setBandSetReplacement(bandSetReplacementRef.current);
    }
    // Only the gain: a band whose frequency or Q was nudged mid-reveal still
    // wants the reference's gain, and skipping it would strand that one band
    // at 0 dB — the very thing this is here to prevent.
    if (action.type === FilterActionEnum.GAIN) {
      revealEditedIdsRef.current?.add(action.id);
    }
    // A group edit says the same thing about each band it moved the gain of.
    if (action.type === FilterActionEnum.EDITS) {
      action.edits.forEach((edit) => {
        if (edit.gain !== undefined) {
          revealEditedIdsRef.current?.add(edit.id);
        }
      });
    }
    applyFilterAction(action);
  }, []);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeDeviceId, setActiveDeviceId] = useState('');

  const setSelectedFilterIds = useCallback((newValue: string[]) => {
    const uniqueIds = [...new Set(newValue.filter(Boolean))];
    setSelectedFilterIdsState(uniqueIds);
    setSelectedFilterIdState(uniqueIds[0] ?? '');
  }, []);

  const setSelectedFilterId = useCallback(
    (newValue: string) => {
      setSelectedFilterIds(newValue ? [newValue] : []);
    },
    [setSelectedFilterIds],
  );

  // The band a shift-click ranges from: wherever the last click without
  // shift landed, as in a file manager. A ref, because it is consulted only
  // inside a click and changing it must not re-render anything.
  const selectionAnchorRef = useRef<string | undefined>(undefined);

  const nextFilterSelection = useCallback(
    (id: string, mode: SelectionMode = 'replace') => {
      const nextIds = nextBandSelection(
        filters,
        selectedFilterIds,
        id,
        mode,
        selectionAnchorRef.current,
      );
      if (mode !== 'range') {
        selectionAnchorRef.current = id;
      }
      return nextIds;
    },
    [filters, selectedFilterIds],
  );

  const toggleFilterSelection = useCallback(
    (id: string, mode: SelectionMode = 'replace') => {
      setSelectedFilterIds(nextFilterSelection(id, mode));
    },
    [nextFilterSelection, setSelectedFilterIds],
  );

  const setGraphViewOn = useCallback((newValue: boolean) => {
    setIsGraphViewOn(newValue);
  }, []);

  const refreshState = useCallback(
    async (options?: IRefreshStateOptions) => {
      try {
        const state = await getEqualizerState();
        updateOutputEditor(state);
        setActiveDeviceId(state.outputEditor?.device.id ?? '');
        adoptOutputDsp(state);
        setIsEnabled(state.isEnabled);
        // The rack's gate hears the saved switch here, with the news that it
        // is the saved one, in one step. The shell follows every later change
        // from the state above, but only a render later — and a gate opened
        // on the default before that render sent the engine a rack for
        // FluidEQ saved off (`rackPlacement.ts`).
        setDspRackGate({ eqLoaded: true, eqEnabled: state.isEnabled });
        // Keep the persisted preference so Auto normalize can be disabled for
        // users who want to set the APO preamp manually.
        setAutoPreAmpOn(state.isAutoPreAmpOn);
        setIsEqDoubleOn(state.isEqDoubleOn === true);
        setEqMode(state.eqMode);
        setEqBandDesign(state.eqBandDesign);
        setCurveEqMode(state.curveEqMode);
        setMainBandQ(state.mainBandQ);
        setEqBandQ(state.eqBandQ);
        setCurveBandQ(state.curveBandQ);
        setCurveSmoothing(state.curveSmoothing);
        setEqCuts(state.eqCuts);
        setGraphViewOn(state.isGraphViewOn);
        setPreAmp(state.preAmp);
        setIsFlat(state.isFlat);
        setEqFormat(state.eqFormat);
        setGraphicEq(state.graphicEq);
        setEqImport(state.eqImport);
        setConvolution(state.convolution);
        setVoicing(state.voicing ?? DEFAULT_VOICING);
        setDriver(state.driver ?? DEFAULT_DRIVER);
        setSmartEq(state.smartEq);
        setTone(state.tone);
        setHeadphone(state.headphone);
        setCustomFx(state.customFx);
        setBypassed(state.bypassed ?? []);
        setHeadset(state.headset);
        setHeadsetTarget(state.headsetTarget);
        setHeadsetSource(state.headsetSource);

        // The band set lands whole either way — same ids, same frequencies,
        // same types — so the layout is right from the first frame and only
        // the gains climb in. Anything else would look like bands appearing
        // out of nowhere rather than like the EQ being tuned.
        const plan = options?.revealBands
          ? planBandReveal(state.filters)
          : undefined;
        dispatchFilter({
          type: FilterActionEnum.INIT,
          filters: plan?.initial ?? state.filters,
        });
        setGlobalError(undefined);
        setIsCaseSensitiveFs(state.isCaseSensitiveFs);

        if (!plan) {
          return;
        }

        // Both claimed after our own INIT, so the reveal is not cancelled by
        // the very replacement it is there to animate.
        const generation = bandSetGenerationRef.current;
        const replacement = bandSetReplacementRef.current;
        const editedDuringReveal = new Set<string>();
        revealEditedIdsRef.current = editedDuringReveal;

        // Straight to the reducer rather than through dispatchFilter: what the
        // reveal draws is not an edit, and recording it as one would make the
        // animation skip every band it had already shown. One action per frame
        // rather than one per band, so the graph — and the auto-headroom write
        // it drives — sees a frame, not a band.
        const land = (bands: IBandRevealBand[]) => {
          const remaining = bands.filter(
            (band) => !editedDuringReveal.has(band.id),
          );
          if (remaining.length > 0) {
            applyFilterAction({
              type: FilterActionEnum.GAINS,
              bands: remaining,
            });
          }
        };

        try {
          const finished = await revealBands(plan.steps, land, {
            isCurrent: () => bandSetGenerationRef.current === generation,
          });
          if (finished || bandSetReplacementRef.current !== replacement) {
            // Either it ran to the end, or a whole new band set took the
            // editor — a second reference applied, Clear EQ, an output switch,
            // all of which arrive as an INIT. What is on screen is right and
            // the rest of this tuning is history.
            return;
          }
          // Otherwise a band was added or deleted, which stops the animation
          // without replacing anything: every band it had not reached is still
          // holding the 0 dB it starts from while Equalizer APO and the saved
          // profile carry the whole reference. Land the remainder at once — a
          // flat editor over a tuned config is a lie the user cannot see, and
          // their next slider drag would write it back.
          land(plan.steps.flat());
        } finally {
          if (revealEditedIdsRef.current === editedDuringReveal) {
            revealEditedIdsRef.current = undefined;
          }
        }
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [dispatchFilter, setGlobalError, setGraphViewOn],
  );

  const performHealthCheck = useCallback(async () => {
    setIsLoading(true);
    await refreshState();
    setIsLoading(false);
  }, [refreshState]);

  useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck]);

  /*
   * THE WRITER DERIVES THE PREAMP; THIS IS HOW THE WINDOW HEARS ABOUT IT.
   *
   * Auto normalize keeps measuring while music plays, so the number moves
   * without anybody touching a control. The renderer used to learn it only when
   * a switch was clicked, which meant the slider and the final curve showed
   * whatever was true at that click and then froze: measured live, the config
   * carried -4.36 dB while the sidebar sat at -20.00 dB and stayed there.
   *
   * The measurement channel already answers with the value the writer settled
   * on. Nothing was listening. This listens.
   */
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT,
      (payload) => {
        const applied = (payload as { result?: unknown } | undefined)?.result;
        if (typeof applied === 'number' && Number.isFinite(applied)) {
          setPreAmp(applied);
        }
      },
    );
    return () => {
      unsubscribe();
    };
  }, []);

  // The main process owns the switch: it notices Windows changing endpoint,
  // loads that output's profile and then says so. Everything on screen — bands,
  // preamp, voicing, driver correction, convolution — is a property of the
  // output it was tuned on, so all of it is re-read here rather than each panel
  // being left to work out that it is now showing the wrong device.
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      OUTPUT_STATE_CHANGED_EVENT,
      (payload) => {
        // Main names the endpoint whose profile it just loaded. It was being
        // dropped, which left the renderer knowing the state had changed but
        // not whose it now was.
        const deviceId = (payload as { deviceId?: string } | undefined)
          ?.deviceId;
        if (typeof deviceId === 'string') {
          setActiveDeviceId(deviceId);
        }
        refreshState();
        // The profile card and the output picker key off this to re-read which
        // profile is attached where.
        window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
      },
    );
    return () => {
      unsubscribe();
    };
  }, [refreshState]);

  const isBlockingError = isBlockingErrorCode(globalError);
  const value = useMemo<IFluidEqContext>(
    () => ({
      activeDeviceId,
      isLoading,
      globalError,
      isBlockingError,
      isEngineUsable: isEnabled && !isBlockingError,
      isEnabled,
      isAutoPreAmpOn,
      isGraphViewOn,
      isCaseSensitiveFs,
      preAmp,
      isFlat,
      eqFormat,
      graphicEq,
      eqImport,
      filters,
      performHealthCheck,
      refreshState,
      setGlobalError,
      setIsEnabled,
      setAutoPreAmpOn,
      setGraphViewOn,
      setPreAmp,
      convolution,
      setConvolution,
      headset,
      headsetTarget,
      headsetSource,
      voicing,
      driver,
      smartEq,
      tone,
      setTone,
      headphone,
      customFx,
      setHeadphone,
      bypassed,
      isEqDoubleOn,
      eqMode,
      eqBandDesign,
      curveEqMode,
      mainBandQ,
      eqBandQ,
      curveBandQ,
      curveSmoothing,
      eqCuts,
      setDriver,
      setVoicing,
      setSmartEq,
      selectedFilterId,
      setSelectedFilterId,
      selectedFilterIds,
      setSelectedFilterIds,
      nextFilterSelection,
      toggleFilterSelection,
      hoveredFilterId,
      setHoveredFilterId,
      dispatchFilter,
      getBandSetGeneration,
      bandSetReplacement,
    }),
    [
      activeDeviceId,
      isLoading,
      globalError,
      isBlockingError,
      isEnabled,
      isAutoPreAmpOn,
      isGraphViewOn,
      isCaseSensitiveFs,
      preAmp,
      isFlat,
      eqFormat,
      graphicEq,
      eqImport,
      filters,
      performHealthCheck,
      refreshState,
      setGlobalError,
      setGraphViewOn,
      convolution,
      headset,
      headsetTarget,
      headsetSource,
      voicing,
      driver,
      smartEq,
      tone,
      headphone,
      customFx,
      bypassed,
      isEqDoubleOn,
      eqMode,
      eqBandDesign,
      curveEqMode,
      mainBandQ,
      eqBandQ,
      curveBandQ,
      curveSmoothing,
      eqCuts,
      selectedFilterId,
      setSelectedFilterId,
      selectedFilterIds,
      setSelectedFilterIds,
      nextFilterSelection,
      toggleFilterSelection,
      hoveredFilterId,
      dispatchFilter,
      getBandSetGeneration,
      bandSetReplacement,
    ],
  );

  return (
    <FluidEqProviderWrapper value={value}>{children}</FluidEqProviderWrapper>
  );
};

/**
 * Everything, bands included — re-renders with every band edit, the preamp,
 * the selection and the hover. For what draws or edits the bands; anything
 * else takes `useFluidEqLayers` or `useFluidEqShell`.
 */
export const useFluidEqContext = () => {
  const context = useContext(FluidEqContext);
  if (context === undefined) {
    throw new Error('useFluidEqContext must be used within an FluidEqProvider');
  }
  return context;
};

/** The equaliser's state and actions only — see `IFluidEqShell`. */
export const useFluidEqShell = (): IFluidEqShell => {
  const context = useContext(FluidEqShellContext);
  if (context === undefined) {
    throw new Error('useFluidEqShell must be used within an FluidEqProvider');
  }
  return context;
};

/** The shell, and every layer and mode — see `IFluidEqLayers`. */
export const useFluidEqLayers = (): IFluidEqLayers => {
  const context = useContext(FluidEqLayersContext);
  if (context === undefined) {
    throw new Error('useFluidEqLayers must be used within an FluidEqProvider');
  }
  return context;
};
