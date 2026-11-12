/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import type { IMemberSceneProblem } from '../../common/memberScenes';
import type { IScenePack } from '../../common/scenePacks';
import { ANIMATION_NAME } from '../../common/studioAnimation';
import { readPlay, recordSheet, type IAnimationPlay } from './animationHistory';
import { jsonErrorLine } from './jsonErrorLine';
import { readProject } from './project';
import { readProjectAnimation } from './projectAnimations';
import { readProjectCode, type TProjectCodeRole } from './projectCode';
import { writeInside } from './projectFiles';

/**
 * A file of the scene edited in the Studio's Code tab (Ivan, 2026-11-11,
 * the mockup he approved: "Editing the scene's files in the Code tab"): its
 * unsaved text checked, and written only once it passes.
 *
 * Checked by the rules every other save of the folder goes through - the
 * member's AI's, their own editor's: the whole scene is built with the draft
 * standing in for the file (`readProject` with drafts), so a draft that would
 * leave the folder unbuildable is never written. A file that fails comes
 * back with every reason, and a line where one is known. An animation's
 * file is held to what its history keeps (`readPlay`) and written through
 * that history, so an edit made here is undone like any other.
 *
 * Only a file the tab lists as the scene's code, read in full there, and of
 * a kind that is code: the shader, the world, a material's GLSL, an
 * animation. Never `pack.json` (the Studio's own settings write it), the
 * notes (their own editor), a file too large to show, or a name the page
 * made up.
 */

export type TCodeEditRole = Extract<
  TProjectCodeRole,
  'scene' | 'world' | 'material' | 'animation'
>;

const EDITABLE: readonly TProjectCodeRole[] = [
  'scene',
  'world',
  'material',
  'animation',
];

/** One reason a draft cannot be saved. */
export interface ICodeProblem {
  code: IMemberSceneProblem['code'] | 'bad-json' | 'bad-animation';
  /** The draft's own line it is on, when that is known. */
  line?: number;
}

export type TCodeCheck =
  | {
      ok: true;
      /** The scene as it would play saved; none for an animation. */ pack?: IScenePack;
    }
  | { ok: false; problems: ICodeProblem[] }
  | { ok: false; refused: 'not-editable' };

export type TCodeWrite =
  'written' | 'failed' | 'not-editable' | { problems: ICodeProblem[] };

/** A text that is not JSON, said with the line it stops being JSON on. */
const badJson = (text: string): ICodeProblem => {
  const line = jsonErrorLine(text);
  return { code: 'bad-json', ...(line ? { line } : {}) };
};

/** The file's role, when it is one the tab edits: listed, shown and code. */
const editableRole = async (
  folder: string,
  file: string,
): Promise<TCodeEditRole | undefined> => {
  const listed = (await readProjectCode(folder)).find(
    (entry) => entry.file === file,
  );
  return listed && listed.text !== undefined && EDITABLE.includes(listed.role)
    ? (listed.role as TCodeEditRole)
    : undefined;
};

/** An animation's name from its file, `animations/<name>.json`. */
const animationName = (file: string) => {
  const name = path.posix.basename(file, '.json');
  return ANIMATION_NAME.test(name) ? name : undefined;
};

type TAnimationDraft =
  { problem: ICodeProblem } | { name: string; play: IAnimationPlay };

/** The animation's draft as its history would keep it, or the reason not. */
const readAnimationDraft = (file: string, text: string): TAnimationDraft => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { problem: badJson(text) };
  }
  const name = animationName(file);
  const play = readPlay(raw);
  // The sheet is always the animation's own picture: the history keeps the
  // two as a pair, and a sheet named elsewhere would not be the one saved.
  const sheet =
    typeof raw === 'object' && raw !== null && 'sheet' in raw
      ? (raw as { sheet: unknown }).sheet
      : undefined;
  if (!name || !play || sheet !== `art/${name}.png`) {
    return { problem: { code: 'bad-animation' } };
  }
  return { name, play };
};

/**
 * Where a problem the build found is, in the file being edited: the rules
 * give the shader's lines; anything else is the file's as a whole.
 */
const inDraft = (
  problem: IMemberSceneProblem,
  role: TCodeEditRole,
): ICodeProblem =>
  problem.line && problem.file === 'source' && role === 'scene'
    ? { code: problem.code, line: problem.line }
    : { code: problem.code };

const checkRole = async (
  folder: string,
  file: string,
  text: string,
  role: TCodeEditRole,
): Promise<TCodeCheck> => {
  if (role === 'animation') {
    const read = readAnimationDraft(file, text);
    return 'problem' in read
      ? { ok: false, problems: [read.problem] }
      : { ok: true };
  }
  if (role === 'world') {
    // Said with its line here: the build calls any unreadable world bad.
    try {
      JSON.parse(text);
    } catch {
      return { ok: false, problems: [badJson(text)] };
    }
  }
  const built = await readProject(folder, new Map([[file, text]]));
  return built.ok
    ? { ok: true, pack: built.pack }
    : {
        ok: false,
        problems: built.problems.map((problem) => inDraft(problem, role)),
      };
};

/** The draft of `file` checked, and the scene it would play as. */
export const checkCodeDraft = async (
  folder: string,
  file: string,
  text: string,
): Promise<TCodeCheck> => {
  const role = await editableRole(folder, file);
  return role
    ? checkRole(folder, file, text, role)
    : { ok: false, refused: 'not-editable' };
};

/** The draft of `file` written over it, when it passes its check. */
export const writeCodeFile = async (
  folder: string,
  file: string,
  text: string,
): Promise<TCodeWrite> => {
  const role = await editableRole(folder, file);
  if (!role) {
    return 'not-editable';
  }
  const checked = await checkRole(folder, file, text, role);
  if (!checked.ok) {
    return 'problems' in checked
      ? { problems: checked.problems }
      : 'not-editable';
  }
  try {
    if (role === 'animation') {
      const read = readAnimationDraft(file, text);
      if ('problem' in read) {
        return { problems: [read.problem] };
      }
      // The sheet as it is: only how it plays was edited.
      const live = await readProjectAnimation(folder, read.name);
      if (!live) {
        return 'failed';
      }
      const recorded = await recordSheet(
        folder,
        read.name,
        live.sheet,
        read.play,
        { label: 'Edited in the Code tab' },
      );
      return recorded.ok
        ? 'written'
        : { problems: [{ code: 'bad-animation' }] };
    }
    await writeInside(
      folder,
      file,
      role === 'scene' ? 'source' : 'world',
      text,
    );
    return 'written';
  } catch {
    return 'failed';
  }
};
