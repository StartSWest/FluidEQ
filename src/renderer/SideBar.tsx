/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { ErrorDescription } from 'common/errors';
import { MAX_GAIN, PREAMP_MIN_GAIN } from 'common/constants';
import { useCallback, useRef } from 'react';
import { setMainPreAmp } from './utils/equalizerApi';
import SideBarEngine from './components/SideBarEngine';
import AutoPreAmpEnablerSwitch from './components/AutoPreAmpEnablerSwitch';
import Knob from './widgets/Knob';
import NumberInput from './widgets/NumberInput';
import './styles/SideBar.scss';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import { useCurrentEngine } from './utils/audioEngineContext';
import { useEnginePreamp, useEnginePreampReader } from './utils/enginePreamp';
import { useGraphMeterHidden } from './utils/graphStyle';
import writeLiveText from './utils/liveText';
import GraphViewSwitch from './components/GraphViewSwitch';
import LiveFigure from './components/LiveFigure';
import OutputLevelMeter from './graph/OutputLevelMeter';
import Spinner from './icons/Spinner';

interface SideBarProps {
  showGraphToggle: boolean;
  isGraphVisible?: boolean;
  /**
   * Whether the drawer is showing, on the widths where this is a drawer.
   *
   * Above the two-column breakpoint it is a column in the layout and this
   * changes nothing — the stylesheet only reads it below that width, where
   * the panel slides down from the titlebar the way the sound panel slides in
   * from the side.
   */
  isOpen?: boolean;
  /**
   * Whether the engine is set up to process the output being listened to, for
   * the engine card — see `engineOnOutput`.
   */
  isEngineOnOutput?: boolean;
  /** Ask about the engine again — see the engine card. */
  onAskAboutEngine: () => void;
  onGraphVisibilityChange?: (next: boolean) => void | Promise<void>;
}

/** What the meter's readout prints while nothing is captured. */
const NO_READING = '–';

/** The readout at its widest: the meter's floor is -60 dB. */
const READING_WIDEST = ['-00.0 dB', NO_READING];

const SideBar = ({
  showGraphToggle,
  isGraphVisible,
  isOpen,
  isEngineOnOutput,
  onAskAboutEngine,
  onGraphVisibilityChange,
}: SideBarProps) => {
  const { isAutoPreAmpOn, isLoading, preAmp, setGlobalError, setPreAmp } =
    useFluidEqContext();
  const { t } = useTranslation();
  const isFluid = useCurrentEngine() === 'fluid';
  useEnginePreampReader(isFluid && isAutoPreAmpOn);
  const livePreamp = useEnginePreamp();
  const automaticPreamp = livePreamp?.enabled ? livePreamp.gainDb : 0;
  const displayedPreamp = isFluid && isAutoPreAmpOn ? automaticPreamp : preAmp;
  const isMeterHidden = useGraphMeterHidden();

  const setGain = useCallback(
    async (newValue: number) => {
      /*
       * SHOWN FIRST, WRITTEN SECOND. THE ORDER IS THE WHOLE FIX.
       *
       * This used to await the round trip to the main process before moving the
       * dial, so every pixel of a drag froze the knob until a config had been
       * written and answered for. The value was never wrong, it was just always
       * a moment late, which is exactly what a control that "does not feel
       * responsive" is made of.
       *
       * Nothing else changes: the same value is sent, once per movement, to the
       * same writer, and the writer remains the authority. If the write fails
       * the error still surfaces, and main's own state is what the next refresh
       * puts back — so the optimistic value can be wrong for as long as it takes
       * to fail, and no longer.
       */
      setPreAmp(newValue);
      try {
        await setMainPreAmp(newValue);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [setGlobalError, setPreAmp],
  );

  // The meter's peak, written straight into the readout. The meter reports
  // from its draw loop, and a state update there would re-render this whole
  // column at the frame rate for one number.
  const readingRef = useRef<HTMLSpanElement>(null);
  const readingTextRef = useRef<HTMLSpanElement>(null);
  const handleReading = useCallback((peakDb: number | null) => {
    writeLiveText(
      readingTextRef.current,
      peakDb === null ? NO_READING : `${peakDb.toFixed(1)} dB`,
    );
    readingRef.current?.classList.toggle('is-idle', peakDb === null);
  }, []);

  return (
    <div className={`col side-bar${isOpen ? ' is-open' : ''}`}>
      {isLoading ? (
        <div className="center full row">
          <Spinner />
        </div>
      ) : (
        <>
          <SideBarEngine
            isEngineOnOutput={isEngineOnOutput}
            onAskAboutEngine={onAskAboutEngine}
          />
          <div className="side-bar__rule" />
          {/* A dial rather than the fader this was.
              The fader wanted three hundred pixels of a column that is one
              hundred and sixty wide — a track, a ceiling caption, a floor
              caption and a number field — which is most of the side bar spent
              on one control. The dial says the same thing in eighty: the
              sweep is the position, the number in the middle is the value.
              It is the same `Knob` the band inspector uses for Q.

              Its floor is the PREAMP's, -60 dB, not a band's ±20: this
              number cancels the sum of every layer, and a headphone
              correction plays as published past ±20 dB (Ivan, 2026-09-23:
              "manual yes -60"). Unity stays at the top of the sweep all the
              same (Ivan, 2026-09-24: "center 0 on top not to the side"): the
              +20 side keeps its half evenly and the -60 side is compressed
              into the other, as fine as the top side near 0 and coarser
              towards the floor (`centredSweep`). The field under it is where
              an exact value is typed, and it takes the same range. */}
          <section className="side-bar__preamp">
            <h4 className="side-bar__head">{t('sidebar.preamp')}</h4>
            <Knob
              name={t('sidebar.preampAria')}
              min={PREAMP_MIN_GAIN}
              max={MAX_GAIN}
              // Unity at the top, which the range cannot say by itself: it
              // is not the middle of -60 to +20. The arc grows from there.
              centre={0}
              value={displayedPreamp}
              step={0.01}
              // The label under the number says who set it: AUTO while Auto
              // normalize owns the dial, the unit while it is yours. It
              // replaces the two-line note that used to say the same thing
              // under the dial, and the switch that turns it off is the row
              // directly beneath.
              unit={isAutoPreAmpOn ? t('sidebar.autoLabel') : 'dB'}
              // Ctrl-click returns it to unity. Without a default the reset is
              // not merely absent — the gesture works everywhere else in the
              // app, so on the one knob that ignored it the feature read as
              // broken rather than unimplemented.
              defaultValue={0}
              isDisabled={isAutoPreAmpOn}
              handleChange={setGain}
            />
            {/* The field is always here, and only its availability moves.
                It used to appear and disappear with auto normalize, which
                made the card change height whenever the switch below it was
                touched and left the dial as the only readout — a dial is a
                poor way to read -6.5 exactly, whoever set it. Disabled while
                auto owns the value says the same thing the swap did, without
                the column jumping. */}
            <NumberInput
              name={t('sidebar.preampAria')}
              value={displayedPreamp}
              min={PREAMP_MIN_GAIN}
              max={MAX_GAIN}
              floatPrecision={2}
              isDisabled={isAutoPreAmpOn}
              handleSubmit={setGain}
            />
            <div className="side-bar__row">
              <label htmlFor="autoPreAmpEnabler">
                {t('sidebar.autoPreamp')}
              </label>
              <AutoPreAmpEnablerSwitch id="autoPreAmpEnabler" />
            </div>
          </section>
          {showGraphToggle ? (
            <>
              <div className="side-bar__rule" />
              <div className="side-bar__row">
                <label htmlFor="graphViewEnabler">
                  {t('sidebar.graphView')}
                </label>
                <GraphViewSwitch
                  id="graphViewEnabler"
                  isOn={isGraphVisible}
                  onToggle={onGraphVisibilityChange}
                />
              </div>
            </>
          ) : null}
          {/* Under the visualizer switch, because it answers the question
              that switch raises: the graph says what the sound is shaped
              like, this says how loud it actually is. The heading carries
              the louder channel's held peak; the well holds the same
              component as the plot's gutter meter. Gone entirely while the
              meter is switched off in the graph's own menu: an empty well
              with a heading over it is a broken instrument, not a hidden
              one. */}
          {!isMeterHidden && (
            <>
              <div className="side-bar__rule" />
              <section className="side-bar__meter">
                <h4 className="side-bar__head">
                  <span>{t('sidebar.output')}</span>
                  <LiveFigure
                    className="side-bar__reading is-idle"
                    widest={READING_WIDEST}
                    textRef={readingTextRef}
                    figureRef={readingRef}
                  >
                    {NO_READING}
                  </LiveFigure>
                </h4>
                <div className="side-bar__well">
                  <OutputLevelMeter onReading={handleReading} />
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SideBar;
