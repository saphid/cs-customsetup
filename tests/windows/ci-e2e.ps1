# Runs guest-e2e.ps1 against a local server on a Windows machine (GitHub Actions windows-latest).
# Starts the server, creates the two profiles guest-e2e.ps1 expects, prints the report and
# exits 1 when any check fails.
param([int]$Port = 18431)
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$server = "http://127.0.0.1:$Port"
$env:PORT = "$Port"; $env:HOST = '127.0.0.1'; $env:PUBLIC_URL = $server; $env:DB_FILE = Join-Path $(if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }) 'cssetup-e2e.db'
$node = Start-Process node -ArgumentList "--disable-warning=ExperimentalWarning `"$(Join-Path $repo 'server\server.mjs')`"" -PassThru -NoNewWindow
try {
    for ($i = 0; $i -lt 30; $i++) { try { Invoke-WebRequest $server -UseBasicParsing | Out-Null; break } catch { Start-Sleep 1 } }
    function New-Profile($body) { (Invoke-RestMethod "$server/api/profiles" -Method Post -Body ($body | ConvertTo-Json -Depth 5) -ContentType 'application/json').code }
    # A: crosshair share code, binds, 4:3 video, Windows pointer speed 10 with precision off
    $a = New-Profile @{ name = 'CI A'
        mouse = @{ sensitivity = 0.9; dpi = 400; windowsPointerSpeed = 10; enhancePointerPrecision = $false }
        crosshair = @{ shareCode = 'CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ'; length = 5; gap = -1; style = 4 }
        binds = @(@{ key = 'f'; command = 'slot7' }, @{ key = 'MWHEELDOWN'; command = '+jump' })
        video = @{ width = 1280; height = 960; aspect = '4:3' } }
    # B: no video, pointer speed 12 with Enhance Pointer Precision on
    $b = New-Profile @{ name = 'CI B'; mouse = @{ windowsPointerSpeed = 12; enhancePointerPrecision = $true }; video = @{ apply = $false } }
    $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'guest-e2e.ps1') -Server $server -CodeA $a -CodeB $b 2>&1 | Out-String
    $report = $out | ConvertFrom-Json
    foreach ($p in $report.results.PSObject.Properties) {
        Write-Host ($(if ($p.Value.ok) { 'PASS ' } else { 'FAIL ' }) + $p.Name)
        if (-not $p.Value.ok) { Write-Host "     $($p.Value.detail)" }
    }
    # The double-click launcher: downloads the script, then runs it with the given arguments.
    $dir = Join-Path $env:TEMP 'cssetup cmd test'; New-Item -ItemType Directory -Force $dir | Out-Null
    $env:LOADOUT_STATE_DIR = Join-Path $env:TEMP 'loadout-ci-state'   # never a real station's state
    Invoke-WebRequest "$server/station.cmd" -OutFile (Join-Path $dir 'Loadout.cmd') -UseBasicParsing
    $cmdOut = & cmd.exe /c "`"$(Join-Path $dir 'Loadout.cmd')`" -Reset" 2>&1 | Out-String
    $cmdOk = $LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $dir 'Loadout.ps1')) -and (Test-Path (Join-Path $dir 'Loadout.signed'))
    # A second online start replaces the signed store in place.
    $again = & cmd.exe /c "`"$(Join-Path $dir 'Loadout.cmd')`" -Reset" 2>&1 | Out-String
    $cmdOk = $cmdOk -and $LASTEXITCODE -eq 0 -and $again -notmatch 'could not update' -and (Test-Path (Join-Path $dir 'Loadout.signed'))
    $cmdOut += $again
    Write-Host ($(if ($cmdOk) { 'PASS ' } else { 'FAIL ' }) + 'Loadout.cmd downloads the station script and runs it')
    if (-not $cmdOk) { Write-Host "     $cmdOut" }
    # Server down: the launcher runs only a verified copy from Loadout.signed.
    Stop-Process -Id $node.Id -Force; Start-Sleep 1
    $cmdFile = Join-Path $dir 'Loadout.cmd'
    $run = { $o = & cmd.exe /c "`"$cmdFile`" -Reset" 2>&1 | Out-String; [pscustomobject]@{ code = $LASTEXITCODE; text = $o } }
    $results = [ordered]@{}
    $r = & $run
    $results['Launcher runs the verified copy while the server is down'] = @(($r.code -eq 0), $r.text)
    # A changed Loadout.ps1 is replaced from the signed copy before it runs.
    [IO.File]::AppendAllText((Join-Path $dir 'Loadout.ps1'), "`r`nWrite-Host 'tampered'`r`n")
    $r = & $run
    $results['Launcher replaces a changed Loadout.ps1 with the signed copy'] = @(($r.code -eq 0 -and $r.text -notmatch 'tampered'), $r.text)
    # A changed signed store is refused.
    $store = Join-Path $dir 'Loadout.signed'; $good = [IO.File]::ReadAllText($store)
    $entry = $good | ConvertFrom-Json
    $bytes = [Convert]::FromBase64String($entry.script) + [Text.Encoding]::UTF8.GetBytes("`r`nWrite-Host 'tampered'`r`n")
    [IO.File]::WriteAllText($store, (@{ signature = $entry.signature; script = [Convert]::ToBase64String($bytes) } | ConvertTo-Json -Compress))
    $r = & $run
    $results['Launcher refuses a tampered signed copy'] = @(($r.code -ne 0 -and $r.text -match 'no verified copy' -and $r.text -notmatch 'tampered'), $r.text)
    [IO.File]::WriteAllText($store, $good)
    # A PC that has seen a newer station version refuses older ones (no downgrade).
    Set-Content (Join-Path $dir 'Loadout.version') 99
    $r = & $run
    $results['Launcher refuses a station older than one it has seen'] = @(($r.code -ne 0 -and $r.text -match 'no verified copy'), $r.text)
    Remove-Item (Join-Path $dir 'Loadout.version')
    $launcherOk = $true
    foreach ($k in $results.Keys) {
        $ok = $results[$k][0]; if (-not $ok) { $launcherOk = $false }
        Write-Host ($(if ($ok) { 'PASS ' } else { 'FAIL ' }) + $k)
        if (-not $ok) { Write-Host "     $($results[$k][1])" }
    }
    if (-not $report.passed -or -not $cmdOk -or -not $launcherOk) { exit 1 }
    $global:LASTEXITCODE = 0   # the tamper check's expected failure must not become this script's exit code
} finally {
    Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
}
