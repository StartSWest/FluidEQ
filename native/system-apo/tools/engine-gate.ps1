<#
FluidEQ: System-wide parametric audio equalizer interface
Copyright (C) 2026  Ivan Carmenates Garcia
SPDX-License-Identifier: GPL-3.0-or-later

The hardware-gate kit for the native Windows audio engine.

Everything the automated test suite can check about this engine, it already
does - the DLL smoke test loads it, the process test feeds it audio, the
registry planner is exercised against fixtures. None of that can see whether
a real audio driver still works once FluidEQ sits beside it in the same
endpoint, whether a laptop's own sound-enhancement suite still finds its
effect, or whether a filter written to disk is actually audible three seconds
later. Those three questions need a real machine, a real speaker and a human
who can hear the answer, so this script is interactive by design: it runs one
step, asks one question, and waits on `Read-Host` rather than guessing at how
long anything takes. There is no `Start-Sleep` anywhere in it - the tone
plays for exactly as long as `[console]::Beep` is told to, which is the one
duration in this script that is actually part of what is being tested, not a
guess about when something else becomes ready.

Every command this script runs against the installed engine is echoed first,
so a run can be read back from its own transcript without repeating it.

Run it twice - once on this PC, once on the Alienware laptop - and send back
the `gate-results.txt` file it writes each time.
#>
[CmdletBinding()]
param(
    # Overrides the automatic search for FluidEQ-Engine-Setup.exe.
    [string]$BinDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ---------------------------------------------------------------------------
# Locate the helper and the DLL it installs.
# ---------------------------------------------------------------------------

function Resolve-BinDir {
    param([string]$Override)

    if ($Override) {
        if (-not (Test-Path (Join-Path $Override 'FluidEQ-Engine-Setup.exe'))) {
            throw "FluidEQ-Engine-Setup.exe is not under $Override"
        }
        return (Resolve-Path $Override).Path
    }

    # Next to this script (a packaged or hand-copied kit), then the build's
    # own output directory (running straight out of a source checkout).
    $candidates = @(
        $PSScriptRoot,
        (Join-Path $PSScriptRoot '..\..\.build\bin')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path (Join-Path $candidate 'FluidEQ-Engine-Setup.exe')) {
            return (Resolve-Path $candidate).Path
        }
    }
    throw ("FluidEQ-Engine-Setup.exe was not found next to this script or " +
        "under ..\..\.build\bin. Run 'pnpm build:native-dsp' first, or pass " +
        "-BinDir to point at where it landed.")
}

$binDir = Resolve-BinDir -Override $BinDir
$SetupExePath = Join-Path $binDir 'FluidEQ-Engine-Setup.exe'
$EnginePath = Join-Path $binDir 'FluidEQ-Engine.dll'

if (-not (Test-Path $EnginePath)) {
    throw ("FluidEQ-Engine.dll is not beside $SetupExePath - 'install' " +
        "refuses to run without it. Rebuild before gating.")
}

$setupVersion = (Get-Item $SetupExePath).VersionInfo.FileVersion
Write-Host "FluidEQ-Engine-Setup.exe $setupVersion" -ForegroundColor Green
Write-Host "  $SetupExePath"
Write-Host "  $EnginePath"

# ---------------------------------------------------------------------------
# A minimal COM shim for "which output is the default one right now" - the
# same question Windows' own volume mixer answers, asked the same way it
# does: through IMMDeviceEnumerator rather than a WMI class that only
# describes hardware, not the endpoint the user actually picked.
# ---------------------------------------------------------------------------

$audioSource = @'
using System;
using System.Runtime.InteropServices;

public static class FluidEqGateAudio
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class MMDeviceEnumeratorComObject { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, uint stateMask, out IntPtr devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr activationParams, out IntPtr instance);
        [PreserveSig] int OpenPropertyStore(uint access, out IntPtr properties);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out uint state);
    }

    // eRender = 0, eMultimedia = 1 - the same (dataFlow, role) pair the
    // system volume mixer and FluidEQ's own device picker both key off.
    public static string GetDefaultRenderEndpointGuid()
    {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
        IMMDevice device;
        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
        string id;
        Marshal.ThrowExceptionForHR(device.GetId(out id));
        var marker = id.LastIndexOf('{');
        if (marker < 0)
        {
            throw new InvalidOperationException("default endpoint id has no guid: " + id);
        }
        return id.Substring(marker);
    }
}
'@
Add-Type -TypeDefinition $audioSource -Language CSharp

# ---------------------------------------------------------------------------
# Small helpers shared by every step.
# ---------------------------------------------------------------------------

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
    param([string]$Step, [string]$Question, [string]$Answer)
    $results.Add([PSCustomObject]@{ Step = $Step; Question = $Question; Answer = $Answer }) | Out-Null
}

# UTF-8 with no byte order mark, matching what the engine's own files are
# written and read as (see native/system-apo/setup/fs.cpp's write_utf8).
# PowerShell 5.1's Set-Content defaults to UTF-8 *with* a BOM, which the
# config parser tolerates but there is no reason to rely on that here.
function Set-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

# Runs the setup helper with its arguments echoed first, captures the one
# line of JSON it always prints (see setup/main.cpp's print_json), and
# returns the exit code alongside the parsed result.
function Invoke-SetupCommand {
    param([Parameter(Mandatory)][string[]]$CommandArgs)
    Write-Host ""
    Write-Host "> $SetupExePath $($CommandArgs -join ' ')" -ForegroundColor Cyan
    $output = & $SetupExePath @CommandArgs
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host $_ }
    $jsonLine = $output | Select-Object -Last 1
    $parsed = $null
    if ($jsonLine) {
        try { $parsed = $jsonLine | ConvertFrom-Json } catch { $parsed = $null }
    }
    [PSCustomObject]@{ ExitCode = $exitCode; Json = $parsed }
}

function Get-SetupErrorText {
    param($CommandResult)
    if ($CommandResult.Json -and $CommandResult.Json.error) {
        return $CommandResult.Json.error
    }
    return 'the setup helper reported nothing'
}

# A dynamic-name property can legitimately be absent - most FxProperties
# values below exist only on endpoints that had something registered in that
# exact slot. Reading through PSObject.Properties rather than dot notation
# is what keeps that a normal $null under `Set-StrictMode -Version Latest`
# instead of "property cannot be found on this object".
function Get-PropertyValue {
    param($Object, [string]$Name)
    if ($null -eq $Object) {
        return $null
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }
    return $property.Value
}

# Compares one FxProperties value (a REG_MULTI_SZ read back as a string
# array, or absent) against the same slot recorded in the backup JSON.
# `$null` and an empty list both mean "nothing here", so they compare equal.
function Compare-FxValue {
    param($Recorded, $Live)
    $recordedArray = @($Recorded | Where-Object { $null -ne $_ })
    $liveArray = @($Live | Where-Object { $null -ne $_ })
    if ($recordedArray.Count -ne $liveArray.Count) {
        return $false
    }
    for ($i = 0; $i -lt $recordedArray.Count; $i++) {
        if ($recordedArray[$i] -ne $liveArray[$i]) {
            return $false
        }
    }
    return $true
}

function Write-GateResults {
    Write-Host ""
    Write-Host "=== Results ===" -ForegroundColor Green
    $results | Format-Table -AutoSize -Wrap | Out-Host

    $resultsPath = Join-Path $env:ProgramData 'FluidEQ\engine\gate-results.txt'
    New-Item -ItemType Directory -Force -Path (Split-Path $resultsPath) | Out-Null
    $lines = @(
        "FluidEQ Engine hardware gate",
        "Machine: $env:COMPUTERNAME",
        "Setup version: $setupVersion",
        "Run at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        ""
    )
    $lines += ($results | ForEach-Object { "[$($_.Step)] $($_.Question): $($_.Answer)" })
    Set-Utf8NoBom -Path $resultsPath -Content ($lines -join "`r`n")
    Write-Host ""
    Write-Host "Results written to $resultsPath" -ForegroundColor Green
    Write-Host "Send that file back - this is what the gate is for." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# The gate itself. Wrapped in try/finally so that Ctrl+C during any prompt
# still writes out whatever was answered so far - there is nothing else to
# clean up: every step below is either read-only or already reversible by
# the setup helper's own 'uninstall'.
# ---------------------------------------------------------------------------

try {
    # --- Step 1: install -----------------------------------------------------
    Write-Host ""
    Write-Host "=== Step 1: install ===" -ForegroundColor Green
    $install = Invoke-SetupCommand -CommandArgs @('install', '--attach-all', '--restart-audio')
    if ($install.ExitCode -ne 0) {
        $reason = Get-SetupErrorText $install
        Write-Host "install failed: $reason" -ForegroundColor Red
        Add-Result '1' 'install --attach-all --restart-audio succeeded' "NO ($reason)"
        return
    }
    Add-Result '1' 'install --attach-all --restart-audio succeeded' 'YES'

    # --- Step 2: the filter, heard -------------------------------------------
    Write-Host ""
    Write-Host "=== Step 2: the filter, heard ===" -ForegroundColor Green
    $configDir = Join-Path $env:ProgramData 'FluidEQ\engine\config'
    $configPath = Join-Path $configDir 'config.txt'
    $filterPath = Join-Path $configDir 'fluideq.txt'
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null

    $withFilter = "Device: all`r`nChannel: all`r`nFilter 1: ON PK Fc 1000 Hz Gain -20 dB Q 4`r`nPreamp: 0 dB`r`n"
    $withoutFilter = "Device: all`r`nChannel: all`r`nPreamp: 0 dB`r`n"

    Write-Host "> write $configPath = Include: fluideq.txt"
    Set-Utf8NoBom -Path $configPath -Content "Include: fluideq.txt`r`n"
    Write-Host "> write $filterPath (with the -20 dB notch at 1 kHz)"
    Set-Utf8NoBom -Path $filterPath -Content $withFilter

    Write-Host "> [console]::Beep(1000, 3000)"
    [console]::Beep(1000, 3000)
    $quiet = Read-Host 'Was the tone quiet/almost gone? (y/n)'
    Add-Result '2' 'Tone dropped with the -20 dB filter applied' $quiet

    Write-Host "> rewrite $filterPath (filter line removed, no restart)"
    Set-Utf8NoBom -Path $filterPath -Content $withoutFilter
    Write-Host "> [console]::Beep(1000, 3000)"
    [console]::Beep(1000, 3000)
    $restored = Read-Host 'Was it back at full volume? (y/n)'
    Add-Result '2' 'Tone returned to full volume with no restart' $restored

    # --- Step 3: the vendor panel ---------------------------------------------
    Write-Host ""
    Write-Host "=== Step 3: the vendor panel ===" -ForegroundColor Green
    Write-Host 'Open your sound-card panel now (Alienware Sound Center / Nahimic / Realtek).'
    $panel = Read-Host 'Do its controls still act? (y/n)'
    Add-Result '3' 'Vendor sound panel controls still act' $panel

    # --- Step 4: detach / attach against whatever else is on this endpoint ---
    Write-Host ""
    Write-Host "=== Step 4: detach / attach ===" -ForegroundColor Green
    $status = Invoke-SetupCommand -CommandArgs @('status')
    if ($status.Json -and $status.Json.endpoints) {
        Write-Host ""
        Write-Host 'Endpoints:'
        $status.Json.endpoints | ForEach-Object {
            Write-Host ("  {0}  attached={1}  backup={2}  {3}" -f $_.guid, $_.attached, $_.backupExists, $_.name)
        }
    }

    $defaultGuid = [FluidEqGateAudio]::GetDefaultRenderEndpointGuid()
    Write-Host ""
    Write-Host "Default output endpoint: $defaultGuid"

    $detach = Invoke-SetupCommand -CommandArgs @('detach', $defaultGuid, '--restart-audio')
    if ($detach.ExitCode -ne 0) {
        Write-Host "detach failed: $(Get-SetupErrorText $detach)" -ForegroundColor Red
    }
    $apoWorks = Read-Host 'Does Equalizer APO (if installed) still process here? (y/n/skip)'
    Add-Result '4' 'Equalizer APO still processes with FluidEQ detached' $apoWorks

    $attach = Invoke-SetupCommand -CommandArgs @('attach', $defaultGuid, '--restart-audio')
    if ($attach.ExitCode -ne 0) {
        Write-Host "attach failed: $(Get-SetupErrorText $attach)" -ForegroundColor Red
    }
    Write-Host "> rewrite $filterPath (filter restored)"
    Set-Utf8NoBom -Path $filterPath -Content $withFilter
    Write-Host "> [console]::Beep(1000, 3000)"
    [console]::Beep(1000, 3000)
    $quietAgain = Read-Host 'Quiet again? (y/n)'
    Add-Result '4' 'Tone dropped again once FluidEQ was reattached' $quietAgain

    # --- Step 5: uninstall and verify the registry came back ------------------
    Write-Host ""
    Write-Host "=== Step 5: uninstall ===" -ForegroundColor Green
    $uninstall = Invoke-SetupCommand -CommandArgs @('uninstall')
    if ($uninstall.ExitCode -ne 0) {
        Add-Result '5' 'uninstall succeeded' "NO ($(Get-SetupErrorText $uninstall))"
    } else {
        Add-Result '5' 'uninstall succeeded' 'YES'
    }

    # 'uninstall' without --purge keeps the backup, which is what makes this
    # comparison possible at all.
    $backupPath = Join-Path $env:ProgramData "FluidEQ\engine\backup\$defaultGuid.json"
    if (-not (Test-Path $backupPath)) {
        Write-Host "No backup file at $backupPath - nothing to compare." -ForegroundColor Yellow
        Add-Result '5' 'Backup file present to compare against' 'NO'
    } else {
        Add-Result '5' 'Backup file present to compare against' 'YES'
        $backup = Get-Content -Raw -Path $backupPath | ConvertFrom-Json

        $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render\$defaultGuid\FxProperties"
        # Get-ItemProperty reads the 64-bit view natively from 64-bit
        # PowerShell - no explicit KEY_WOW64_64KEY flag needed here, unlike
        # the native side.
        $liveProps = if (Test-Path $regPath) { Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue } else { $null }

        # pids 13, 14, 15 - the composite SFX/MFX/EFX lists this engine edits.
        $compositeGuid = '{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}'
        $compositePids = @(13, 14, 15)
        # pids 5, 6, 7 - the signal processing modes beside each of those.
        $modeGuid = '{d3993a3f-99c2-4402-b5ec-a92a0367664b}'
        $modePids = @(5, 6, 7)

        for ($slot = 0; $slot -lt 3; $slot++) {
            $compositeName = "$compositeGuid,$($compositePids[$slot])"
            $liveComposite = Get-PropertyValue -Object $liveProps -Name $compositeName
            $compositeMatch = Compare-FxValue $backup.composite[$slot] $liveComposite
            $verdict = if ($compositeMatch) { 'MATCH' } else { 'MISMATCH' }
            Write-Host ("  {0}: {1}" -f $compositeName, $verdict)
            Add-Result '5' "$compositeName restored" $verdict

            $modeName = "$modeGuid,$($modePids[$slot])"
            $liveMode = Get-PropertyValue -Object $liveProps -Name $modeName
            $modeMatch = Compare-FxValue $backup.modes[$slot] $liveMode
            $modeVerdict = if ($modeMatch) { 'MATCH' } else { 'MISMATCH' }
            Write-Host ("  {0}: {1}" -f $modeName, $modeVerdict)
            Add-Result '5' "$modeName restored" $modeVerdict
        }
    }
} finally {
    Write-GateResults
}
