param(
    [string]$UpstreamPath = '',
    [string]$Repository = 'https://github.com/jaakkopasanen/AutoEq.git'
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputPath = [IO.Path]::GetFullPath((Join-Path $repoRoot 'autoeq'))
$stagingPath = [IO.Path]::GetFullPath((Join-Path $repoRoot '.autoeq-next'))
$expectedOutputPath = [IO.Path]::GetFullPath((Join-Path $repoRoot 'autoeq'))

if ($outputPath -ne $expectedOutputPath -or !$outputPath.StartsWith($repoRoot)) {
    throw 'Refusing to replace an AutoEq directory outside the FluidEQ repository.'
}

$temporaryClone = $null
try {
    if (!$UpstreamPath) {
        $temporaryClone = Join-Path ([IO.Path]::GetTempPath()) (
            'fluideq-autoeq-' + [Guid]::NewGuid().ToString('N')
        )
        & git clone --depth 1 --filter=blob:none --sparse $Repository $temporaryClone
        if ($LASTEXITCODE -ne 0) { throw 'Unable to clone the official AutoEq repository.' }
        & git -C $temporaryClone sparse-checkout set results
        if ($LASTEXITCODE -ne 0) { throw 'Unable to check out the official AutoEq results.' }
        $UpstreamPath = $temporaryClone
    }

    $upstreamRoot = [IO.Path]::GetFullPath($UpstreamPath)
    $resultsPath = Join-Path $upstreamRoot 'results'
    if (!(Test-Path -LiteralPath $resultsPath -PathType Container)) {
        throw "AutoEq results directory not found: $resultsPath"
    }

    if (Test-Path -LiteralPath $stagingPath) {
        Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stagingPath | Out-Null

    $profiles = @(Get-ChildItem -LiteralPath $resultsPath -Recurse -File -Filter '* ParametricEQ.txt')
    if ($profiles.Count -lt 1000) {
        throw "Only $($profiles.Count) profiles were found; refusing to replace the bundled library."
    }

    foreach ($profile in $profiles) {
        $relativePath = $profile.FullName.Substring($resultsPath.Length + 1)
        $parts = $relativePath -split '[\\/]'
        if ($parts.Count -ne 4) {
            throw "Unexpected AutoEq result path: $relativePath"
        }

        $source = $parts[0]
        $measurementRig = $parts[1]
        $model = $parts[2]
        $modelPath = Join-Path $stagingPath $model
        $responsePath = Join-Path $modelPath "$source ($measurementRig)"

        if (!(Test-Path -LiteralPath $modelPath)) {
            New-Item -ItemType Directory -Path $modelPath | Out-Null
        }
        if (Test-Path -LiteralPath $responsePath) {
            throw "Duplicate AutoEq response: $model / $source ($measurementRig)"
        }
        Copy-Item -LiteralPath $profile.FullName -Destination $responsePath
    }

    $modelCount = @(Get-ChildItem -LiteralPath $stagingPath -Directory).Count
    if ($modelCount -lt 1000) {
        throw "Only $modelCount models were generated; refusing to replace the bundled library."
    }

    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Recurse -Force
    }
    Move-Item -LiteralPath $stagingPath -Destination $outputPath

    $commit = (& git -C $upstreamRoot rev-parse HEAD).Trim()
    Write-Output "Imported $($profiles.Count) profiles for $modelCount models from AutoEq $commit"
}
finally {
    if ($temporaryClone -and (Test-Path -LiteralPath $temporaryClone)) {
        Remove-Item -LiteralPath $temporaryClone -Recurse -Force
    }
    if (Test-Path -LiteralPath $stagingPath) {
        Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
}
