# <FluidEQ: System-wide parametric audio equalizer interface>
# Copyright (C) 2026  Ivan Carmenates Garcia
# SPDX-License-Identifier: GPL-3.0-or-later
#
# What the registry knows about installed games, as JSON.
#
# Steam, the Epic launcher and the Xbox app keep their lists in files, which
# the app reads itself. The others keep theirs in the registry, and each one
# differently: GOG and Ubisoft in a key of their own, EA and Blizzard only in
# Windows' own list of installed programs, under a publisher's name. Reading
# it here costs one process instead of several hundred registry calls through
# the app's VBScript helper.
#
# Each row is {name, path, source}. `path` is the game's folder: no list here
# says which of the executables under it a player would recognise, and the app
# matches anything run from inside it.

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

$found = New-Object System.Collections.ArrayList

function Add-Game([string]$name, [string]$path, [string]$source) {
  if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($path)) {
    return
  }
  $trimmed = $path.Trim().TrimEnd('\', '/')
  if ($trimmed.Length -lt 4 -or -not (Test-Path -LiteralPath $trimmed -PathType Container)) {
    return
  }
  [void]$found.Add([pscustomobject]@{
    name   = $name.Trim()
    path   = $trimmed
    source = $source
  })
}

# GOG keeps a key per game, with the name and the folder in it.
foreach ($root in @('HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games', 'HKLM:\SOFTWARE\GOG.com\Games')) {
  foreach ($key in (Get-ChildItem $root)) {
    $values = Get-ItemProperty $key.PSPath
    Add-Game $values.gameName $values.path 'gog'
  }
}

# Ubisoft Connect keeps the folder and not the name; the folder is named after
# the game, which is what its own launcher shows for an install it cannot name.
foreach ($root in @('HKLM:\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs', 'HKLM:\SOFTWARE\Ubisoft\Launcher\Installs')) {
  foreach ($key in (Get-ChildItem $root)) {
    $dir = (Get-ItemProperty $key.PSPath).InstallDir
    if ($dir) {
      Add-Game (Split-Path -Leaf ($dir.TrimEnd('\', '/'))) $dir 'ubisoft'
    }
  }
}

# Origin wrote a key per game; the EA app that replaced it did not, and its
# games are in Windows' list of installed programs like everything else.
foreach ($root in @('HKLM:\SOFTWARE\WOW6432Node\Origin Games', 'HKLM:\SOFTWARE\Origin Games')) {
  foreach ($key in (Get-ChildItem $root)) {
    $values = Get-ItemProperty $key.PSPath
    $dir = $values.'Install Dir'
    if ($dir) {
      Add-Game (Split-Path -Leaf ($dir.TrimEnd('\', '/'))) $dir 'ea'
    }
  }
}

# Windows' own list, for the launchers that keep no list of their own. Only
# rows a publisher marks as theirs: everything else in this hive is a driver,
# a runtime or an update, and offering all of it as games is offering nothing.
$publishers = @{
  'electronic arts'          = 'ea'
  'ea'                       = 'ea'
  'blizzard entertainment'   = 'battlenet'
  'blizzard entertainment inc.' = 'battlenet'
  'ubisoft'                  = 'ubisoft'
  'ubisoft entertainment'    = 'ubisoft'
  'gog.com'                  = 'gog'
  'cd projekt red'           = 'gog'
}
$uninstall = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($entry in (Get-ItemProperty $uninstall)) {
  $publisher = $entry.Publisher
  $location = $entry.InstallLocation
  if (-not $publisher -or -not $location -or -not $entry.DisplayName) {
    continue
  }
  $source = $publishers[$publisher.ToString().Trim().ToLowerInvariant()]
  if ($source) {
    Add-Game $entry.DisplayName $location $source
  }
}

# Steam's own folder, so the app can read the library list inside it. The
# libraries themselves are often on another drive, which that file names.
$steam = $null
foreach ($key in @('HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam', 'HKLM:\SOFTWARE\Valve\Steam')) {
  $values = Get-ItemProperty $key
  if (-not $steam) {
    if ($values.SteamPath) { $steam = $values.SteamPath }
    elseif ($values.InstallPath) { $steam = $values.InstallPath }
  }
}

$answer = [pscustomobject]@{
  games = @($found)
  steam = $steam
}
$answer | ConvertTo-Json -Depth 3 -Compress
