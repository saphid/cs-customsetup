# End-to-end station test for a Windows guest without CS2 installed.
# Builds a Steam/CS2 folder layout, downloads the station script from the
# server, and loads two players' codes, checking files and Windows mouse
# settings after every step. CodeA: crosshair share code, binds, 4:3 video.
# CodeB: no video, pointer speed 12 with Enhance Pointer Precision on.
param([string]$Server = 'http://10.0.2.2:18431', [string]$CodeA, [string]$CodeB)
$ErrorActionPreference = 'Stop'
$root = 'C:\CSSetupTest'
$steam = Join-Path $root 'Steam'
$game = Join-Path $steam 'steamapps\common\Counter-Strike Global Offensive'
$cfgDir = Join-Path $game 'game\csgo\cfg'
$userCfg = Join-Path $steam 'userdata\123456789\730\local\cfg'
$userCfg2 = Join-Path $steam 'userdata\222222\730\local\cfg'
$results = [ordered]@{}
function Check([string]$name, [bool]$ok, $detail) { $results[$name] = [ordered]@{ ok = $ok; detail = "$detail" } }
function Read([string]$path) { if (Test-Path $path) { [IO.File]::ReadAllText($path) } else { $null } }

Add-Type -Namespace E2E -Name Spi -MemberDefinition @"
[DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint a, uint p, int[] v, uint w);
[DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint a, uint p, IntPtr v, uint w);
"@
function Mouse {
    $a = New-Object int[] 3; [void][E2E.Spi]::SystemParametersInfo(3, 0, $a, 0)
    $s = New-Object int[] 1; [void][E2E.Spi]::SystemParametersInfo(0x70, 0, $s, 0)
    "$($s[0])/$($a[0]),$($a[1]),$($a[2])"
}
function SetMouse($speed, $t1, $t2, $accel) {
    [void][E2E.Spi]::SystemParametersInfo(0x71, 0, [IntPtr]$speed, 3)
    [void][E2E.Spi]::SystemParametersInfo(4, 0, [int[]]@($t1, $t2, $accel), 3)
}
$video = "`"video.cfg`"`n{`n`t`"Version`"`t`t`"16`"`n`t`"setting.defaultres`"`t`t`"1920`"`n`t`"setting.defaultresheight`"`t`t`"1080`"`n`t`"setting.fullscreen`"`t`t`"1`"`n`t`"setting.nowindowborder`"`t`t`"0`"`n`t`"setting.shaderquality`"`t`t`"0`"`n}`n"

function New-Station([switch]$NoAccounts, [switch]$EmptyAutoexec) {
    if (Test-Path $root) { Get-ChildItem $root -Recurse -File | ForEach-Object { $_.IsReadOnly = $false }; Remove-Item $root -Recurse -Force }
    Remove-Item (Join-Path $env:LOCALAPPDATA 'CSSetup') -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $cfgDir | Out-Null
    [IO.File]::WriteAllText((Join-Path $steam 'steamapps\libraryfolders.vdf'), "`"libraryfolders`"`n{`n`t`"0`"`n`t{`n`t`t`"path`"`t`t`"$($steam -replace '\\','\\')`"`n`t}`n}`n")
    if ($EmptyAutoexec) { [IO.File]::WriteAllText((Join-Path $cfgDir 'autoexec.cfg'), '') }
    else { [IO.File]::WriteAllText((Join-Path $cfgDir 'autoexec.cfg'), "// station admin autoexec`r`ncl_join_advertise 2`r`n") }
    if (-not $NoAccounts) {
        New-Item -ItemType Directory -Force $userCfg | Out-Null
        [IO.File]::WriteAllText((Join-Path $userCfg 'cs2_video.txt'), $video)
        [IO.File]::WriteAllText((Join-Path $userCfg 'cs2_user_convars_0_slot0.vcfg'), '"config" { "convars" { "sensitivity" "2.5" } }')
    }
}

# Each station step runs in a fresh powershell.exe, like a real station.
$script = Join-Path $env:TEMP 'CSSetup-e2e.ps1'
function Station([string[]]$arguments) {
    $ErrorActionPreference = 'Continue'   # station errors arrive on stderr; keep them as text
    $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -SteamRoot $steam @arguments 2>&1
    [pscustomobject]@{ code = $LASTEXITCODE; text = (($out | ForEach-Object { "$_" }) -join "`n").Trim() }
}

$guestMouse = Mouse
New-Station
Invoke-WebRequest "$Server/station.ps1" -OutFile $script -UseBasicParsing
Check 'download' ((Read $script) -match [regex]::Escape("'$Server'")) 'server URL baked in'
$origAutoexec = Read (Join-Path $cfgDir 'autoexec.cfg')
$origVideo = Read (Join-Path $userCfg 'cs2_video.txt')
SetMouse 14 6 10 1   # a non-default station mouse, so every change is visible
$stationMouse = Mouse

$r = Station @('-Code', '000000')
Check 'unknown code: clean error, nothing changed' ($r.code -eq 1 -and $r.text -match 'CS Setup: No setup found' -and -not (Test-Path (Join-Path $cfgDir 'cssetup.cfg'))) $r.text

# Player A
Set-Clipboard -Value 'before'
$r = Station @('-Code', $CodeA)
Check 'A: load succeeds' ($r.code -eq 0) $r.text
$cfg = Read (Join-Path $cfgDir 'cssetup.cfg')
Check 'A: cfg has defaults, binds, new crosshair convars' ($cfg -match '(?m)^binddefaults' -and $cfg -match 'bind "f" "slot7"' -and $cfg -match 'cl_crosshair_length "5"' -and $cfg -notmatch 'apply_crosshair_code') ''
Check 'A: autoexec keeps admin lines and execs cssetup' ((Read (Join-Path $cfgDir 'autoexec.cfg')) -match '(?s)cl_join_advertise 2.*exec cssetup') ''
$v = Read (Join-Path $userCfg 'cs2_video.txt')
Check 'A: video 1280x960 4:3, LF kept' ($v -match '"setting.defaultres"\s+"1280"' -and $v -match '"setting.aspectratiomode"\s+"0"' -and $v -notmatch "`r") ''
Check 'A: Windows mouse 10, precision off' ((Mouse) -eq '10/0,0,0') (Mouse)
Check 'A: crosshair code on clipboard' ((Get-Clipboard) -eq 'CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ') (Get-Clipboard)
Check 'A: notes reported as info' ($r.text -match '(?m)^i Crosshair code copied') ''
[IO.File]::WriteAllText((Join-Path $userCfg 'cs2_user_keys_0_slot0.vcfg'), 'written by CS2 while A played')
$userCfg3 = Join-Path $steam 'userdata\333333\730\local\cfg'   # A logged into their own Steam account
New-Item -ItemType Directory -Force $userCfg3 | Out-Null
[IO.File]::WriteAllText((Join-Path $userCfg3 'cs2_user_convars_0_slot0.vcfg'), 'A personal account settings')

# Player B straight after A, without a reset
$r = Station @('-Code', $CodeB)
Check 'B: load succeeds' ($r.code -eq 0 -and $r.text -notmatch 'Saved the station baseline') $r.text
Check 'B: nothing of A remains' (-not (Test-Path (Join-Path $userCfg 'cs2_user_keys_0_slot0.vcfg')) -and -not (Test-Path (Join-Path $userCfg3 'cs2_user_convars_0_slot0.vcfg')) -and (Read (Join-Path $cfgDir 'cssetup.cfg')) -notmatch 'slot7') ''
Check 'B: video untouched (B does not apply video)' ((Read (Join-Path $userCfg 'cs2_video.txt')) -eq $origVideo) ''
Check 'B: Windows mouse 12, precision on' ((Mouse) -eq '12/6,10,1') (Mouse)

# This PC's mouse runs at 800 DPI: A's 0.9 at 400 DPI becomes 0.45 (remembered setting)
$r = Station @('-Code', $CodeA, '-MouseDpi', '800')
Check 'station DPI: sensitivity converted' ($r.code -eq 0 -and (Read (Join-Path $cfgDir 'cssetup.cfg')) -match '(?m)^sensitivity "0.45"') $r.text
$r = Station @('-Code', $CodeA)
Check 'station DPI: remembered on the next load' ((Read (Join-Path $cfgDir 'cssetup.cfg')) -match '(?m)^sensitivity "0.45"') $r.text
Remove-Item (Join-Path $env:LOCALAPPDATA 'CSSetup\station.json')

# An account folder that appears after the baseline belongs to a player: cleared
New-Item -ItemType Directory -Force $userCfg2 | Out-Null
[IO.File]::WriteAllText((Join-Path $userCfg2 'cs2_video.txt'), $video.Replace('1920', '2560'))
$r = Station @('-Code', $CodeA)
Check 'new account folder: cleared on load' ($r.code -eq 0 -and -not (Test-Path (Join-Path $userCfg2 'cs2_video.txt'))) $r.text

# A failed load puts the station back: another program holds a player file open.
[IO.File]::WriteAllText((Join-Path $userCfg2 'cs2_video.txt'), 'player file')
$lock = [IO.File]::Open((Join-Path $userCfg2 'cs2_video.txt'), 'Open', 'ReadWrite', 'None')
$r = Station @('-Code', $CodeA)
$lock.Close()
Check 'failed load: error names the locked file' ($r.code -eq 1 -and $r.text -match 'Load failed' -and $r.text -match '222222') $r.text
Check 'failed load: no player files left' (-not (Test-Path (Join-Path $cfgDir 'cssetup.cfg')) -and (Read (Join-Path $cfgDir 'autoexec.cfg')) -eq $origAutoexec -and (Read (Join-Path $userCfg 'cs2_video.txt')) -eq $origVideo) ''
Check 'failed load: station mouse back' ((Mouse) -eq $stationMouse) (Mouse)

# Reset
$r = Station @('-Code', $CodeA)
$r = Station @('-Reset')
Check 'reset: succeeds' ($r.code -eq 0 -and $r.text -match 'reset to its original') $r.text
Check 'reset: cfg removed, autoexec restored' (-not (Test-Path (Join-Path $cfgDir 'cssetup.cfg')) -and (Read (Join-Path $cfgDir 'autoexec.cfg')) -eq $origAutoexec) ''
Check 'reset: station video restored, player folder empty' ((Read (Join-Path $userCfg 'cs2_video.txt')) -eq $origVideo -and -not (Test-Path (Join-Path $userCfg2 'cs2_video.txt'))) ''
Check 'reset: station vcfg kept' (Test-Path (Join-Path $userCfg 'cs2_user_convars_0_slot0.vcfg')) ''
Check 'reset: station mouse back' ((Mouse) -eq $stationMouse) (Mouse)
$r = Station @('-Reset')
Check 'second reset is a no-op' ($r.text -match 'Nothing to reset') $r.text

# A baseline written by the previous version (userCfgs, no steamRoot) still resets
$r = Station @('-Code', $CodeA)
$bf = Join-Path $env:LOCALAPPDATA 'CSSetup\baseline\baseline.json'
$old = Get-Content $bf -Raw | ConvertFrom-Json
[pscustomobject]@{ created = $old.created; mouse = $old.mouse; files = $old.files; userCfgs = @($userCfg) } | ConvertTo-Json -Depth 5 | Set-Content $bf -Encoding UTF8
New-Item -ItemType Directory -Force $userCfg2 | Out-Null
[IO.File]::WriteAllText((Join-Path $userCfg2 'cs2_user_convars_0_slot0.vcfg'), 'player account created after the old baseline')
$r = Station @('-Reset')
Check 'old baseline format: reset succeeds' ($r.code -eq 0 -and (Read (Join-Path $cfgDir 'autoexec.cfg')) -eq $origAutoexec -and (Mouse) -eq $stationMouse) $r.text
Check 'old baseline format: new account folder cleared' (-not (Test-Path (Join-Path $userCfg2 'cs2_user_convars_0_slot0.vcfg'))) ''

# A damaged station.json is reported and ignored; load and reset still work
$r = Station @('-Code', $CodeA)
[IO.File]::WriteAllText((Join-Path $env:LOCALAPPDATA 'CSSetup\station.json'), '{ "mouseDpi": "lots"')
$r = Station @('-Reset')
Check 'damaged station.json: reset still works' ($r.code -eq 0 -and $r.text -match 'Ignoring' -and $r.text -match 'reset to its original') $r.text
Remove-Item (Join-Path $env:LOCALAPPDATA 'CSSetup\station.json')

# A station where CS2 never ran: empty autoexec, no account folders
New-Station -NoAccounts -EmptyAutoexec
$r = Station @('-Code', $CodeA)
Check 'fresh PC: load succeeds with a resolution warning' ($r.code -eq 0 -and $r.text -match '(?m)^! Resolution not set') $r.text
Check 'fresh PC: autoexec execs cssetup' ((Read (Join-Path $cfgDir 'autoexec.cfg')) -match '^exec cssetup') ''
# A player's own first run during their session is theirs: cleared, never adopted
New-Item -ItemType Directory -Force $userCfg | Out-Null
[IO.File]::WriteAllText((Join-Path $userCfg 'cs2_video.txt'), 'player-modified video')
$r = Station @('-Code', $CodeA)
Check 'fresh PC: player-created video is not adopted' ($r.code -eq 0 -and -not (Test-Path (Join-Path $userCfg 'cs2_video.txt'))) $r.text
$r = Station @('-SaveBaseline')
Check 'save baseline refused while a setup is loaded' ($r.code -eq 1 -and $r.text -match 'Reset this PC first') $r.text
# The admin follows the warning: reset, run CS2 once, save the baseline, load again.
$r = Station @('-Reset')
[IO.File]::WriteAllText((Join-Path $userCfg 'cs2_video.txt'), $video)
$r = Station @('-SaveBaseline')
Check 'admin saves the baseline' ($r.code -eq 0 -and $r.text -match 'Saved this PC') $r.text
$r = Station @('-Code', $CodeA)
Check 'fresh PC: load after setup sets the resolution' ($r.code -eq 0 -and $r.text -match 'Set video to 1280x960' -and $r.text -notmatch 'Saved the station baseline') $r.text
$r = Station @('-Reset')
Check 'fresh PC: reset succeeds' ($r.code -eq 0 -and (Read (Join-Path $cfgDir 'autoexec.cfg')) -eq '' -and -not (Test-Path (Join-Path $cfgDir 'cssetup.cfg'))) $r.text
Check 'fresh PC: reset keeps the first-run video file' ((Read (Join-Path $userCfg 'cs2_video.txt')) -eq $video) ''
Check 'fresh PC: station mouse back' ((Mouse) -eq $stationMouse) (Mouse)

$parts = $guestMouse -split '[/,]'
SetMouse ([int]$parts[0]) ([int]$parts[1]) ([int]$parts[2]) ([int]$parts[3])
[pscustomobject]@{ passed = @($results.Values | Where-Object { -not $_.ok }).Count -eq 0; guestMouseRestored = ((Mouse) -eq $guestMouse); results = $results } | ConvertTo-Json -Depth 4
