/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';
import type { LocaleCode } from '..';
import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import hi from './hi';
import it from './it';
import ja from './ja';
import pt from './pt';
import ru from './ru';
import zh from './zh';

/**
 * The Linux app's words where the shared ones speak of Windows or Equalizer
 * APO: "Restart Windows audio" for an engine that is FluidEQ's own child,
 * permission prompts that never come, requirements that name Windows 10.
 * Laid over the dictionaries (`setPlatformText`) by the window and by main
 * when they start on Linux, so the shared files — which every merge from main
 * brings — stay exactly main's, and these are the only Linux-only words.
 *
 * Loaded whole rather than per language: the Linux branch builds only for
 * Linux, where every one of them can be needed, and they are a few dozen keys.
 */
const LINUX_TEXT: Record<LocaleCode, Partial<Dictionary>> = {
  en,
  es,
  pt,
  fr,
  de,
  it,
  ru,
  zh,
  ja,
  hi,
};

export default LINUX_TEXT;
