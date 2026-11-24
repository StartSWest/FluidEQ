/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Tuning Agent Door: a local-only Streamable HTTP MCP server for AI-guided
 * audio tuning (EQ, OPRA headphone corrections, presets, DSP rack, microphone
 * processing, and live acoustic metering).
 *
 * Reuses `createAgentServer` and `createMcpHandler` directly from
 * `main/studioAgent/` so it inherits identical transport hardening:
 * - 127.0.0.1 loopback only, strict Host check, browser Origin rejected.
 * - 256-bit random Bearer token compared in constant time, stored mode 0o600.
 * - Closed by default until the listener explicitly switches it on.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import {
  TUNING_AGENT_CHANNELS,
  type ITuningAgentDoor,
  type ITuningSessionSummary,
  type TTuningAbMode,
} from '../../common/tuningAgent';
import writeFileAtomically from '../atomicWrite';
import {
  AGENT_HOST,
  AGENT_PATH,
  createAgentServer,
} from '../studioAgent/agentServer';
import { createMcpHandler } from '../studioAgent/mcpProtocol';
import type { ITuningController } from './tuningController';
import createTuningTools from './tuningTools';

export const TUNING_DOOR_FILE = 'tuning-agent.json';
/** Next to Studio's 47391; falls back to any free port if already taken. */
export const TUNING_PREFERRED_PORT = 47392;

interface IDoorSettings {
  open: boolean;
  port: number;
  key: string;
}

const newKey = () => randomBytes(32).toString('base64url');

const readSettings = (file: string): IDoorSettings => {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      const { open, port, key } = raw as Record<string, unknown>;
      if (
        typeof open === 'boolean' &&
        typeof port === 'number' &&
        Number.isInteger(port) &&
        port > 0 &&
        port < 65536 &&
        typeof key === 'string' &&
        /^[A-Za-z0-9_-]{43}$/.test(key)
      ) {
        return { open, port, key };
      }
    }
  } catch {
    // Missing or unreadable settings file defaults to closed with a fresh key.
  }
  return { open: false, port: TUNING_PREFERRED_PORT, key: newKey() };
};

const INSTRUCTIONS = [
  'FluidEQ is a live Windows system-wide parametric EQ and DSP audio processor running on the listener computer.',
  'Closed-loop tuning workflow:',
  '(1) Always call get_audio_context first to inspect nowPlaying (current song/artist/player), output device type (headphones vs monitor/desktop speakers), exact composite effectiveCurve across all active layers, and DSP rack state.',
  '(2) Call measure_live_audio to read 15-band ISO levels, FluidEQ mastering reference-curve deviations, crestFactorDb, sibilance frequency, and automatic acoustic observations. If the listener mentions a headphone model, check search_headphone_correction and apply OPRA into the dedicated headphone layer.',
  '(3) Call get_tuning_guide(goal, stage) when mapping subjective goals (e.g. vocal_clarity, small_speakers, remove_mud, punchy_bass, tame_harshness) or inspecting exact DSP stage ranges.',
  '(4) Make conservative, surgical edits (1.5-3 dB EQ steps or subtle DSP mix) without double-boosting on top of active layers shown in effectiveCurve. Keep Room OFF on speakers and prefer bassForge harmonics over sub-bass EQ boosts on small monitor/laptop speakers.',
  '(5) Re-call measure_live_audio after edits to verify deltaFromPrevious and confirm clippingRisk=false. Ear-safety limits are enforced in code (manual preamp <= 0 dB, main EQ -18..+12 dB, limiter ceilings <= -0.3 dBTP, isolate flags stripped).',
  '(6) A baseline snapshot is captured automatically before your first edit. Offer tuning_session(action="ab_compare") so the listener judges Original vs Tuned by ear, iterates on feedback, and then reverts or saves as a user preset.',
].join(' ');

export interface ITuningAgentDoorDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null | undefined;
  controller: ITuningController;
  appVersion: string;
  /** Optional port override for tests (pass 0 for ephemeral OS port). */
  preferredPort?: number;
  /** Set false in headless tests where Electron ipcMain is absent. */
  registerIpc?: boolean;
  /** Called whenever the MCP door actually opens or closes. */
  onOpenChanged?: (open: boolean) => void;
  logger?: {
    info(message: string): void;
    warn(message: string): void;
  };
}

export const createTuningAgentDoor = ({
  userDataDir,
  getMainWindow,
  controller,
  appVersion,
  preferredPort,
  registerIpc = true,
  onOpenChanged,
  logger,
}: ITuningAgentDoorDeps) => {
  const file = path.join(userDataDir, TUNING_DOOR_FILE);
  let settings = readSettings(file);
  if (preferredPort !== undefined) {
    settings = { ...settings, port: preferredPort };
  }
  let listeningOn: number | undefined;
  let failed = false;

  const save = () => {
    try {
      writeFileAtomically(file, JSON.stringify(settings), 0o600);
    } catch (error) {
      logger?.warn(`Could not save the Tuning agent door: ${String(error)}`);
    }
  };

  const state = (): ITuningAgentDoor => {
    const session: ITuningSessionSummary = controller.getSession();
    return settings.open && listeningOn !== undefined
      ? {
          open: true,
          url: `http://${AGENT_HOST}:${listeningOn}${AGENT_PATH}`,
          key: settings.key,
          session,
        }
      : { open: false, ...(failed ? { failed: true } : {}), session };
  };

  const pageOf = () => {
    const window = getMainWindow();
    return window && !window.isDestroyed() ? window.webContents : undefined;
  };

  const notifyWindow = () => {
    const page = pageOf();
    if (page && !page.isDestroyed()) {
      page.send(TUNING_AGENT_CHANNELS.changed, state());
    }
  };

  const server = createAgentServer({
    key: () => settings.key,
    handle: createMcpHandler(
      {
        name: 'fluideq-tuning',
        title: 'FluidEQ Audio Tuning',
        version: appVersion,
        instructions: INSTRUCTIONS,
      },
      createTuningTools(controller),
    ),
    ...(logger ? { logger } : {}),
  });

  const listen = async () => {
    if (listeningOn !== undefined) {
      return;
    }
    try {
      listeningOn = await server.listen(settings.port);
      failed = false;
      if (listeningOn !== settings.port) {
        settings = { ...settings, port: listeningOn };
        save();
      }
      logger?.info(
        `FluidEQ Tuning MCP listening on ${AGENT_HOST}:${listeningOn}`,
      );
      onOpenChanged?.(true);
    } catch (error) {
      failed = true;
      logger?.warn(`The Tuning agent door did not open: ${String(error)}`);
    }
  };

  const shut = async () => {
    failed = false;
    if (listeningOn === undefined) {
      return;
    }
    listeningOn = undefined;
    await server.close();
    onOpenChanged?.(false);
    logger?.info('FluidEQ Tuning MCP closed.');
  };

  let changing: Promise<void> = Promise.resolve();
  const follow = () => {
    changing = changing.then(() => (settings.open ? listen() : shut()));
    return changing;
  };

  const setOpen = async (open: boolean): Promise<ITuningAgentDoor> => {
    settings = { ...settings, open };
    save();
    await follow();
    const next = state();
    notifyWindow();
    return next;
  };

  const rotateKey = (): ITuningAgentDoor => {
    settings = { ...settings, key: newKey() };
    save();
    const next = state();
    notifyWindow();
    return next;
  };

  const fromWindow = (event: IpcMainInvokeEvent) => pageOf() === event.sender;

  if (registerIpc) {
    ipcMain.handle(TUNING_AGENT_CHANNELS.getDoor, (event) =>
      fromWindow(event)
        ? state()
        : { open: false, session: controller.getSession() },
    );

    ipcMain.handle(
      TUNING_AGENT_CHANNELS.setDoor,
      async (event, open: unknown) => {
        if (!fromWindow(event) || typeof open !== 'boolean') {
          return state();
        }
        return setOpen(open);
      },
    );

    ipcMain.handle(TUNING_AGENT_CHANNELS.newKey, (event) =>
      fromWindow(event) ? rotateKey() : state(),
    );

    ipcMain.handle(TUNING_AGENT_CHANNELS.revert, async (event) => {
      if (!fromWindow(event)) {
        return { ok: false, error: 'Unauthorized window.' };
      }
      const outcome = await controller.revert();
      notifyWindow();
      return outcome;
    });

    ipcMain.handle(
      TUNING_AGENT_CHANNELS.abToggle,
      async (event, mode: unknown) => {
        if (!fromWindow(event)) {
          return { ok: false, error: 'Unauthorized window.' };
        }
        const parsedMode: TTuningAbMode | undefined =
          mode === 'original' || mode === 'tuned' ? mode : undefined;
        const outcome = await controller.abCompare(parsedMode);
        notifyWindow();
        return outcome;
      },
    );
  }

  if (settings.open) {
    follow().catch(() => undefined);
  }

  return {
    state,
    setOpen,
    rotateKey,
    notifyWindow,
    dispose: async () => {
      if (registerIpc) {
        [
          TUNING_AGENT_CHANNELS.getDoor,
          TUNING_AGENT_CHANNELS.setDoor,
          TUNING_AGENT_CHANNELS.newKey,
          TUNING_AGENT_CHANNELS.revert,
          TUNING_AGENT_CHANNELS.abToggle,
        ].forEach((channel) => ipcMain.removeHandler(channel));
      }
      settings = { ...settings, open: false };
      await follow();
    },
  };
};
