# Real CS2 check on a Windows PC with Steam signed in and CS2 installed.
# 1. Optionally seeds CS2's own config with a conflicting sensitivity (proves +exec order).
# 2. Loads a profile through the station script (real Steam paths, -MouseDpi).
# 3. Launches CS2 with -condebug and +exec cssetup, waits until CS2 has executed it and saved
#    its own settings, then compares the account's cs2_user_convars/keys vcfg with cssetup.cfg.
#    (echo and convar printouts do not reach console.log; the saved vcfg is CS2's own record.)
# WARNING: CS2 uploads its settings to the signed-in account's Steam Cloud. Use a station
# account, or turn Steam Cloud off for CS2 first.
# Prints JSON: each verified convar/bind with expected and actual values.
param(
    [Parameter(Mandatory)][string]$Code,
    [string]$Server = 'http://10.0.2.2:18431',
    [int]$MouseDpi = 800,
    [string[]]$ExtraLaunch = @(),
    [int]$TimeoutSec = 1800,
    [switch]$SeedConflict,
    # Start cs2.exe directly (with the current environment) instead of through steam.exe -applaunch.
    [switch]$Direct
)
$ErrorActionPreference = 'Stop'
$steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam').SteamPath -replace '/', '\'
$work = 'C:\CSSetupTest\real'; New-Item -ItemType Directory -Force $work | Out-Null
$station = Join-Path $work 'Loadout.ps1'
Invoke-WebRequest "$Server/station.ps1" -OutFile $station -UseBasicParsing
$bundle = Invoke-RestMethod "$Server/api/profiles/$Code/station?dpi=$MouseDpi" -UseBasicParsing

# Find the game the same way the station does.
$libs = @($steam) + @([regex]::Matches((Get-Content "$steam\steamapps\libraryfolders.vdf" -Raw), '"path"\s+"([^"]+)"') | ForEach-Object { $_.Groups[1].Value -replace '\\\\', '\' })
$game = $libs | ForEach-Object { Join-Path $_ 'steamapps\common\Counter-Strike Global Offensive' } | Where-Object { Test-Path (Join-Path $_ 'game\csgo') } | Select-Object -First 1
if (-not $game) { throw 'CS2 not found' }
$cfgDir = Join-Path $game 'game\csgo\cfg'
$log = Join-Path $game 'game\csgo\console.log'
$exe = Join-Path $steam 'steam.exe'

$inv = [Globalization.CultureInfo]::InvariantCulture
function Get-Number([string]$text) {
    $n = 0.0
    if ([double]::TryParse($text, [Globalization.NumberStyles]::Float, $inv, [ref]$n)) { return $n }
    return $null
}

# Expected end state of a cfg, in execution order: '<convar>' -> value, 'bind <key>' -> command
# ('' when unbound). Comments are stripped only outside quotes, as in web/rules.js.
function Parse-Expected([string]$cfgText) {
    $expected = [ordered]@{}
    foreach ($line in ($cfgText -split "`r?`n")) {
        $q = $false; $cut = $line.Length
        for ($i = 0; $i -lt $line.Length - 1; $i++) {
            if ($line[$i] -eq '"') { $q = -not $q }
            elseif (-not $q -and $line[$i] -eq '/' -and $line[$i + 1] -eq '/') { $cut = $i; break }
        }
        $tokens = @([regex]::Matches($line.Substring(0, $cut), '"[^"]*"|\S+') | ForEach-Object { $_.Value.Trim('"') })
        if (-not $tokens.Count) { continue }
        $head = $tokens[0].ToLower()
        if ($head -in 'binddefaults', 'echo') { continue }
        if ($head -eq 'bind' -and $tokens.Count -eq 3) { $expected['bind ' + $tokens[1].ToLower()] = $tokens[2]; continue }
        if ($head -eq 'unbind' -and $tokens.Count -eq 2) { $expected['bind ' + $tokens[1].ToLower()] = ''; continue }
        if ($tokens.Count -eq 2) { $expected[$head] = $tokens[1] }
    }
    $expected
}

# Runs CS2 until $done (a scriptblock over the console log text) is true, while CS2 is still
# running, then closes it. Returns @{ ok; log }.
function Run-Cs2([string[]]$cmdArgs, [scriptblock]$done) {
    Remove-Item $log -ErrorAction SilentlyContinue
    $common = @('-condebug', '-novid', '-windowed', '-w', '1280', '-h', '720') + $ExtraLaunch + $cmdArgs
    if ($Direct) {
        $bin = Join-Path $game 'game\bin\win64'
        Start-Process (Join-Path $bin 'cs2.exe') -ArgumentList $common -WorkingDirectory $bin
    } else {
        Start-Process $exe -ArgumentList (@('-applaunch', '730') + $common)
    }
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $ok = $false; $text = ''
    while ((Get-Date) -lt $deadline) {
        Start-Sleep 10
        $text = if (Test-Path $log) { Get-Content $log -Raw } else { '' }
        if ($text -and (& $done $text)) { $ok = $true; break }
    }
    Start-Sleep 10   # let Steam finish writing the files CS2 just saved
    Get-Process cs2 -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 5
    @{ ok = $ok; log = $(if (Test-Path $log) { Get-Content $log -Raw } else { $text }) }
}
# True once the log shows $marker and then a save of the user convars after it.
function Saved-After([string]$text, [string]$marker) {
    $i = $text.LastIndexOf($marker)
    $i -ge 0 -and $text.IndexOf("Saved user config file 'cfg/cs2_user_convars", $i) -gt $i
}

# The signed-in account (Steam must be running) decides which userdata folder CS2 writes.
$active = (Get-ItemProperty 'HKCU:\Software\Valve\Steam\ActiveProcess' -ErrorAction SilentlyContinue).ActiveUser
if (-not $active) { throw 'Steam is not running with a signed-in account' }
$userCfg = Join-Path $steam "userdata\$active\730\local\cfg"
function Read-Vcfg([string]$name) { $f = Join-Path $userCfg $name; if (Test-Path $f) { Get-Content $f -Raw } else { '' } }
function Vcfg-Value([string]$text, [string]$key) {
    $m = [regex]::Match($text, '(?i)"' + [regex]::Escape($key) + '"\s+"([^"]*)"')
    if ($m.Success) { $m.Groups[1].Value } else { $null }
}

$result = [ordered]@{ steam = $steam; game = $game; account = $active; seedRan = $null }
$expected = Parse-Expected $bundle.cfg
# Seed values must differ from what the profile sets, or the override proves nothing.
# (outside the 0.0005 comparison tolerance used below)
$seedSens = if ([math]::Abs((Get-Number $expected['sensitivity']) - 3) -lt 0.01) { 4 } else { 3 }
$seedFov = if ([math]::Abs((Get-Number $expected['viewmodel_fov']) - 61) -lt 0.01) { 62 } else { 61 }
if ($SeedConflict) {
    # Start from a clean station, save a conflicting config with CS2, and make sure it is
    # still on disk when the profile launches: the profile's +exec must override it.
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $station -Reset 2>&1 | Out-Null
    $seed = Run-Cs2 @('+sensitivity', "$seedSens", '+viewmodel_fov', "$seedFov", '+host_writeconfig') { param($t) (Get-Number (Vcfg-Value (Read-Vcfg 'cs2_user_convars_0_slot0.vcfg') 'sensitivity')) -eq $seedSens }
    $sv = Read-Vcfg 'cs2_user_convars_0_slot0.vcfg'
    $result.seedRan = $seed.ok -and (Get-Number (Vcfg-Value $sv 'sensitivity')) -eq $seedSens -and (Get-Number (Vcfg-Value $sv 'viewmodel_fov')) -eq $seedFov
    if (-not $result.seedRan) { $result.passed = $false; $result.error = 'seed config was not saved'; $result | ConvertTo-Json -Depth 5; return }
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $station -Code $Code -MouseDpi $MouseDpi 2>&1 | Out-Null
$result.stationExit = $LASTEXITCODE
if ($SeedConflict) {
    $result.conflictBeforeLaunch = (Get-Number (Vcfg-Value (Read-Vcfg 'cs2_user_convars_0_slot0.vcfg') 'sensitivity')) -eq $seedSens
}

# The station must have written exactly the bundle's cfg.
$result.cfgMatchesBundle = (Get-Content (Join-Path $cfgDir 'cssetup.cfg') -Raw -Encoding UTF8) -ceq $bundle.cfg
$run = Run-Cs2 @('+exec', 'cssetup') { param($t) Saved-After $t 'execing cssetup' }
$result.execedAndSaved = $run.ok
$convars = Read-Vcfg 'cs2_user_convars_0_slot0.vcfg'
$keys = Read-Vcfg 'cs2_user_keys_0_slot0.vcfg'
# Not archived, so CS2 never saves them; reported but not counted.
$unsaved = @('cl_showfps')
$checks = [ordered]@{}
foreach ($k in @($expected.Keys)) {
    $isBind = $k -like 'bind *'
    $key = if ($isBind) { $k.Substring(5) } else { $k }
    if (($isBind -and $key -like 'scancode*') -or (-not $isBind -and $unsaved -contains $key)) {
        $checks[$k] = [ordered]@{ expected = $expected[$k]; actual = $null; ok = $null; note = 'not verifiable from the saved config' }
        continue
    }
    $actual = Vcfg-Value $(if ($isBind) { $keys } else { $convars }) $key
    $ok = $false
    if ($isBind -and $expected[$k] -eq '') { $ok = [string]::IsNullOrEmpty($actual) }   # unbound
    elseif ($null -ne $actual) {
        $a = Get-Number $actual; $e = Get-Number $expected[$k]
        if ($null -ne $a -and $null -ne $e) { $ok = [math]::Abs($a - $e) -lt 0.0005 }
        elseif ($actual -in 'true', 'false' -and $expected[$k] -in '0', '1') { $ok = ($actual -eq 'true') -eq ($expected[$k] -eq '1') }
        else { $ok = $actual -eq $expected[$k] }
    }
    $checks[$k] = [ordered]@{ expected = $expected[$k]; actual = $actual; ok = $ok }
}
$result.checks = $checks
$failed = @($checks.Values | Where-Object { $_.ok -eq $false })
$result.passed = $run.ok -and $result.stationExit -eq 0 -and $result.cfgMatchesBundle -and $failed.Count -eq 0 -and @($checks.Values | Where-Object { $_.ok -eq $true }).Count -gt 0 -and (-not $SeedConflict -or $result.conflictBeforeLaunch)
$result.consoleTail = ($run.log -split "`n" | Select-Object -Last 40) -join "`n"
$result | ConvertTo-Json -Depth 5
