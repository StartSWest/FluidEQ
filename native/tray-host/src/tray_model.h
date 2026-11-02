/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * What the tray is told and what it does with no window to ask: the icon,
 * the tooltip and the menu main hands it, in the words of the language the
 * window uses, and the recipe for taking FluidEQ's sound off every output
 * (`engineQuitReset.ts`) — so a quit from the tray, or Windows ending the
 * session, leaves no EQ on an output however FluidEQ's other processes
 * stand.
 */

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "fluideq/share/json.h"

namespace feq::tray {

struct MenuItem {
  /** What a press sends back to main: open, quit, check-updates, … */
  std::string id;
  std::wstring label;
  /** An .ico or .png beside the label; empty for none. */
  std::wstring icon;
  /** A separator follows it. */
  bool separator_after = false;
};

/**
 * `resetEngineForQuit` as data: the engine root that means "nothing to do",
 * and the files a quit takes away — by name, and every per-output file whose
 * name is one of `remove_prefixes` and a canonical endpoint GUID
 * (`isOutputConfigFileName`).
 */
struct QuitRecipe {
  std::wstring config_dir;
  std::wstring root_name;
  std::string root_text;
  std::vector<std::wstring> remove_names;
  std::vector<std::wstring> remove_prefixes;
};

struct TrayState {
  std::wstring tooltip;
  std::wstring icon;
  std::vector<MenuItem> menu;
};

/** A `state` message from main; nothing for one that is not. */
std::optional<TrayState> parse_state(const share::json::Value& message);

/**
 * A `recipe` message: the recipe from now on, or none while main has
 * written no engine folder yet — and then a quit has nothing to undo.
 */
struct RecipeMessage {
  std::optional<QuitRecipe> recipe;
};

/** A `recipe` message from main; nothing for one that is not. */
std::optional<RecipeMessage> parse_recipe(const share::json::Value& message);

/** How main asked to be started again once it has left (`appLeave.ts`). */
struct Relaunch {
  std::wstring file;
  std::vector<std::wstring> args;
  /** Its working folder; empty for the tray's own. */
  std::wstring cwd;
};

/**
 * A `leaving` message: main is ending with FluidEQ going on, and this is how
 * to start it again. Nothing for another message, or for one that names no
 * program — a tray told that could never open FluidEQ again.
 */
std::optional<Relaunch> parse_leaving(const share::json::Value& message);

/**
 * What the tray needs to tell the FluidEQ Engine the playing song while main
 * is gone (`song_watch.h`), handed over in main's `leaving` message when
 * the engine is the FluidEQ Engine and installed.
 */
struct SongsHandover {
  /** `FluidEQ-Media.exe`, and the app's own id, its one argument. */
  std::wstring media_exe;
  std::wstring self_id;
  /** Where the programme files are written, and the engine's statuses read. */
  std::wstring config_dir;
  std::wstring status_dir;
  /** Main's `song-levels.json`. */
  std::wstring levels_file;
  /** The main output's file, and what starts each output's own. */
  std::string root_name;
  std::string per_output_prefix;
  /** The output Windows played through as main left; empty for none. */
  std::string main_endpoint;
  /** One player at a time, and main's own command that pauses the others. */
  bool single_player = false;
  std::wstring pause_file;
  std::vector<std::wstring> pause_args;
};

/** The handover in a `leaving` message; nothing when main sent none. */
std::optional<SongsHandover> parse_leaving_songs(
    const share::json::Value& message);

/** `isOutputConfigFileName` for one of the recipe's prefixes. */
bool is_output_file(std::wstring_view name,
                    const std::vector<std::wstring>& prefixes);

/** Every file in `config_dir` the recipe takes away, as full paths. */
std::vector<std::wstring> files_to_remove(const QuitRecipe& recipe);

/**
 * Writes the root (through a file beside it and a rename, so the engine
 * never reads half of one) and removes the files. Each failure is reported
 * and the rest carry on; true when nothing failed.
 */
bool apply_recipe(const QuitRecipe& recipe,
                  std::vector<std::string>* failures = nullptr);

/**
 * `text` as the whole of `path`, written beside it and renamed over it
 * the way main's own writer does, so nothing ever reads half of it. The
 * Windows error that stopped it, or 0.
 */
unsigned long write_atomically(const std::wstring& path, const std::string& text);

/** UTF-8 to UTF-16, and back, for what the wire carries. */
std::wstring wide(std::string_view text);
std::string narrow(std::wstring_view text);

}  // namespace feq::tray
