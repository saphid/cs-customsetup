# Runs guest-e2e.ps1 against a local server on a Windows machine (GitHub Actions windows-latest).
# Starts the server, creates the two profiles guest-e2e.ps1 expects, prints the report and
# exits 1 when any check fails.
param([int]$Port = 18431)
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$server = "http://127.0.0.1:$Port"
$env:PORT = "$Port"; $env:HOST = '127.0.0.1'; $env:DB_FILE = Join-Path $(if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }) 'cssetup-e2e.db'
$node = Start-Process node -ArgumentList "--disable-warning=ExperimentalWarning `"$(Join-Path $repo 'server\server.mjs')`" -PassThru -NoNewWindow
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
    Invoke-WebRequest "$server/station.cmd" -OutFile (Join-Path $dir 'CSSetup.cmd') -UseBasicParsing
    $cmdOut = & cmd.exe /c "`"$(Join-Path $dir 'CSSetup.cmd')`" -Reset" 2>&1 | Out-String
    $cmdOk = $LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $dir 'CSSetup.ps1')) -and -not (Test-Path (Join-Path $dir 'CSSetup.ps1.download'))
    Write-Host ($(if ($cmdOk) { 'PASS ' } else { 'FAIL ' }) + 'CSSetup.cmd downloads the station script and runs it')
    if (-not $cmdOk) { Write-Host "     $cmdOut" }
    if (-not $report.passed -or -not $cmdOk) { exit 1 }
} finally {
    Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
}
