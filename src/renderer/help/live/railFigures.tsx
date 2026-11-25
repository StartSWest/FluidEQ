/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useCallback, useRef } from 'react';
import { MAX_GAIN, PREAMP_MIN_GAIN } from 'common/constants';
import LiveFigure from '../../components/LiveFigure';
import PowerGlyph from '../../icons/PowerGlyph';
import { useTranslation } from '../../utils/I18nContext';
import writeLiveText from '../../utils/liveText';
import Knob from '../../widgets/Knob';
import Switch from '../../widgets/Switch';
import HelpMeter from './HelpMeter';
import HelpMusic from './HelpMusic';
import '../../styles/SideBar.scss';

/**
 * The window chapter's left rail, as `SideBar` lays it out: FluidEQ's power
 * key with the engine's name and state under it, the preamp's dial with Auto
 * normalize under it, the graph's switch and the output meter.
 *
 * The dial and the switches are the rail's own widgets; the power key and the
 * two switch rows are their markup, class for class, because the rail's own
 * parts read the reader's engine, power and graph and act on them. The meter
 * is `HelpMeter`, moving with made-up music: the real one claims the
 * reader's audio capture. Laid out in a column of the rail's own width
 * (`$side-bar-width`), as tall as a short window gives it, with the FluidEQ
 * Engine on and Auto normalize holding the dial.
 */

const nothing = () => undefined;
const nowhere = async () => undefined;

const NO_READING = '–';
const READING_WIDEST = ['-00.0 dB', NO_READING];

/**
 * The meter and the number over it, written as `SideBar` writes it: straight
 * into the readout from the meter's report, never a render of the column.
 */
const MeterSection = () => {
  const { t } = useTranslation();
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
        <HelpMusic>
          <HelpMeter onReading={handleReading} />
        </HelpMusic>
      </div>
    </section>
  );
};

/** The rail's column, and the room a window of about 900px leaves it. */
const COLUMN = { width: 132, height: 700 };

export default function RailDrawing() {
  const { t } = useTranslation();
  return (
    <div
      style={{ width: COLUMN.width, height: COLUMN.height, display: 'flex' }}
    >
      <div className="col side-bar" style={{ flex: 1, overflow: 'hidden' }}>
        <div className="side-bar__power">
          <button
            type="button"
            className="side-bar__power-button is-on"
            aria-label={t('sidebar.systemEq')}
          >
            <PowerGlyph />
          </button>
          <span className="side-bar__power-name">{t('sidebar.systemEq')}</span>
          <span className="side-bar__power-state">
            {t('sidebar.state.on', { engine: t('engine.fluid.name') })}
          </span>
        </div>
        <div className="side-bar__rule" />
        <section className="side-bar__preamp">
          <h4 className="side-bar__head">{t('sidebar.preamp')}</h4>
          <Knob
            name={t('sidebar.preampAria')}
            min={PREAMP_MIN_GAIN}
            max={MAX_GAIN}
            centre={0}
            value={-3.5}
            step={0.01}
            unit={t('sidebar.autoLabel')}
            defaultValue={0}
            isDisabled
            handleChange={nowhere}
          />
          <div className="side-bar__row">
            <label htmlFor="help-rail-auto">{t('sidebar.autoPreamp')}</label>
            <Switch
              id="help-rail-auto"
              isOn
              isDisabled={false}
              handleToggle={nothing}
            />
          </div>
        </section>
        <div className="side-bar__rule" />
        <div className="side-bar__row">
          <label htmlFor="help-rail-graph">{t('sidebar.graphView')}</label>
          <Switch
            id="help-rail-graph"
            isOn
            isDisabled={false}
            handleToggle={nothing}
          />
        </div>
        <div className="side-bar__rule" />
        <MeterSection />
      </div>
    </div>
  );
}
