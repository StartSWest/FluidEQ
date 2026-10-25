#!/usr/bin/env bash
# FluidEQ — GPL-3.0-or-later
set -euo pipefail
command -v gjs >/dev/null
wallpaper_source="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
wallpaper_uuid='desktop@fluideq.app'
if [[ "$(gnome-shell --version)" != 'GNOME Shell 50.'* ]]; then
  printf '%s\n' 'FluidEQ Desktop currently supports GNOME Shell 50.' >&2
  exit 1
fi
wallpaper_target="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$wallpaper_uuid"
install -d -- "$wallpaper_target"
install -m 644 -- "$wallpaper_source/gnome-extension/metadata.json" "$wallpaper_source/gnome-extension/extension.js" "$wallpaper_source/gnome-extension/protocol.js" "$wallpaper_source/gnome-extension/colours.js" "$wallpaper_target/"
# A new local extension is discovered at the next GNOME login. Keep the
# listener's other enabled/disabled extensions exactly as they chose them.
gjs -c 'const Gio = imports.gi.Gio; const settings = new Gio.Settings({schema_id: "org.gnome.shell"}); const uuid = ARGV[0]; const enabled = settings.get_strv("enabled-extensions"); if (!enabled.includes(uuid)) settings.set_strv("enabled-extensions", [...enabled, uuid]); const disabled = settings.get_strv("disabled-extensions"); if (disabled.includes(uuid)) settings.set_strv("disabled-extensions", disabled.filter(item => item !== uuid)); Gio.Settings.sync();' "$wallpaper_uuid"
printf '%s\n' 'FluidEQ Desktop installed. Sign out and sign back in to load it, then start FluidEQ.'
