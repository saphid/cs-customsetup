<#
Loadout station. Type a 6-digit code, get your CS2 setup on this PC.

  Loadout.ps1                      Full-screen station window
  Loadout.ps1 -Code 123456         Apply without the window
  Loadout.ps1 -Reset               Put the station back as it was before the first load
  Loadout.ps1 -SaveBaseline        Admin: capture this PC's current state as the baseline
  Loadout.ps1 -Launch              Start CS2 with the loaded profile
  Loadout.ps1 -MouseDpi 800        This PC's mouse DPI (remembered); sensitivity
                                   is converted so each player's eDPI stays the same
  Loadout.ps1 -Check               Admin: is this PC ready? (exit code 2 when not)
  Loadout.ps1 -ConfirmCloudOff     Admin: record that Steam Cloud is off for CS2
  Loadout.ps1 -Prefetch 123456,234567
                                   Admin: cache these setups so they load even if
                                   the server goes down

Downloads are checked against the server's signing key, baked in below.

The first load saves the station's original files and mouse settings under
%LOCALAPPDATA%\CSSetup\baseline. Reset restores that baseline, so every
player starts from the same station state.
#>
[CmdletBinding()]
param(
    [string]$Code,
    [switch]$Reset,
    [switch]$SaveBaseline,
    [switch]$Launch,
    [string]$Server = '__SERVER_URL__',
    [string]$SteamRoot,
    [ValidateScript({ $_ -eq 0 -or ($_ -ge 50 -and $_ -le 32000) })][int]$MouseDpi = 0,
    [switch]$Windowed,
    [switch]$Check,
    [switch]$ConfirmCloudOff,
    [string[]]$Prefetch,
    [string]$SigningKey = '__SIGNING_KEY__',
    [string]$KeyFingerprint = '__SIGNING_FP__'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# LOADOUT_STATE_DIR is for tests, so they never touch a real station's baseline.
$StateDir = if ($env:LOADOUT_STATE_DIR) { $env:LOADOUT_STATE_DIR } else { Join-Path $env:LOCALAPPDATA 'CSSetup' }
$Baseline = Join-Path $StateDir 'baseline'
$CacheDir = Join-Path $StateDir 'cache'
$CfgName = 'cssetup'
$CsFolder = 'steamapps\common\Counter-Strike Global Offensive'

# The station mouse's DPI is set once by the admin and remembered. A damaged
# file is reported and ignored, so it can never block a reset.
$StationFile = Join-Path $StateDir 'station.json'
$StationDpi = 0
$CloudOffConfirmed = $false
$StationWarning = $null
if (Test-Path $StationFile) {
    try {
        $saved = Get-Content $StationFile -Raw | ConvertFrom-Json
        $value = 0
        if ($saved -and $saved.PSObject.Properties['mouseDpi'] -and [int]::TryParse([string]$saved.mouseDpi, [ref]$value) -and $value -ge 50 -and $value -le 32000) {
            $StationDpi = $value
        } elseif ($MouseDpi -eq 0) { $StationWarning = "Ignoring $StationFile`: no valid mouseDpi. Run with -MouseDpi to set it." }
        if ($saved -and $saved.PSObject.Properties['cloudOffConfirmed']) { $CloudOffConfirmed = [bool]$saved.cloudOffConfirmed }
    } catch { $StationWarning = "Ignoring $StationFile`: $($_.Exception.Message)" }
}
if ($MouseDpi -gt 0) { $StationDpi = $MouseDpi }
if ($ConfirmCloudOff) { $CloudOffConfirmed = $true }
if ($MouseDpi -gt 0 -or $ConfirmCloudOff) {
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    @{ mouseDpi = $StationDpi; cloudOffConfirmed = $CloudOffConfirmed } | ConvertTo-Json | Set-Content $StationFile -Encoding UTF8
}
if ($StationWarning) { [Console]::Error.WriteLine("Loadout: $StationWarning") }

# One station action at a time across windows and command lines on this PC.
$StationMutex = New-Object Threading.Mutex($false, 'Local\LoadoutStation')
function Enter-Station([int]$waitMs) {
    try { return $StationMutex.WaitOne($waitMs) } catch [Threading.AbandonedMutexException] { return $true }
}

# ---------------------------------------------------------------- signatures

# True when $signature (base64) is the server's RSA-SHA256 signature of $bytes.
function Test-Signature([byte[]]$bytes, [string]$signature) {
    if ($SigningKey -notlike '<RSAKeyValue>*') { throw 'This copy of the station has no signing key. Download Loadout.cmd from the Loadout server.' }
    if (-not $signature) { return $false }
    $rsa = New-Object Security.Cryptography.RSACryptoServiceProvider
    try {
        $rsa.FromXmlString($SigningKey)
        return $rsa.VerifyData($bytes, 'SHA256', [Convert]::FromBase64String($signature))
    } catch { return $false } finally { $rsa.Dispose() }
}

Add-Type -Namespace CSSetup -Name Native -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true)]
public static extern bool SystemParametersInfo(uint action, uint param, int[] vparam, uint winIni);
[DllImport("user32.dll", SetLastError = true)]
public static extern bool SystemParametersInfo(uint action, uint param, IntPtr vparam, uint winIni);
'@

# ---------------------------------------------------------------- Steam paths

function Get-SteamRoot {
    if ($SteamRoot) { return $SteamRoot }
    foreach ($key in 'HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam', 'HKLM:\SOFTWARE\Valve\Steam') {
        $item = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        if ($item) {
            foreach ($name in 'SteamPath', 'InstallPath') {
                if ($item.PSObject.Properties[$name] -and (Test-Path $item.$name)) {
                    return ($item.$name -replace '/', '\')
                }
            }
        }
    }
    $default = Join-Path ${env:ProgramFiles(x86)} 'Steam'
    if (Test-Path $default) { return $default }
    throw 'Steam is not installed on this PC.'
}

function Get-Cs2Folder([string]$steam) {
    $libraries = @($steam)
    $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
    if (Test-Path $vdf) {
        foreach ($m in [regex]::Matches((Get-Content $vdf -Raw), '"path"\s+"([^"]+)"')) {
            $libraries += ($m.Groups[1].Value -replace '\\\\', '\')
        }
    }
    foreach ($lib in $libraries | Select-Object -Unique) {
        $game = Join-Path $lib $CsFolder
        if (Test-Path (Join-Path $game 'game\csgo')) { return $game }
    }
    throw 'Counter-Strike 2 is not installed in any Steam library on this PC.'
}

# Per-account CS2 folders; CS2 has used both local and remote.
function Get-UserCfgFolders([string]$steam) {
    $userdata = Join-Path $steam 'userdata'
    if (-not (Test-Path $userdata)) { return @() }
    @(Get-ChildItem $userdata -Directory | ForEach-Object {
        foreach ($kind in 'local', 'remote') {
            $dir = Join-Path $_.FullName "730\$kind\cfg"
            if (Test-Path $dir) { $dir }
        }
    })
}

function Test-Cs2Running { [bool](Get-Process -Name cs2 -ErrorAction SilentlyContinue) }

# ---------------------------------------------------------------- Windows mouse

$SPI_GETMOUSE = 0x0003; $SPI_SETMOUSE = 0x0004
$SPI_GETMOUSESPEED = 0x0070; $SPI_SETMOUSESPEED = 0x0071
$SPIF_UPDATE = 0x03 # update the user profile and broadcast the change

function Get-WindowsMouse {
    $accel = New-Object int[] 3
    [void][CSSetup.Native]::SystemParametersInfo($SPI_GETMOUSE, 0, $accel, 0)
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)
    try {
        [void][CSSetup.Native]::SystemParametersInfo($SPI_GETMOUSESPEED, 0, $buffer, 0)
        $speed = [Runtime.InteropServices.Marshal]::ReadInt32($buffer)
    } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer) }
    [pscustomobject]@{ pointerSpeed = $speed; threshold1 = $accel[0]; threshold2 = $accel[1]; acceleration = $accel[2] }
}

# Applies immediately and persists to HKCU\Control Panel\Mouse.
function Set-WindowsMouse([int]$speed, [int]$t1, [int]$t2, [int]$accel) {
    if (-not [CSSetup.Native]::SystemParametersInfo($SPI_SETMOUSESPEED, 0, [IntPtr]$speed, $SPIF_UPDATE)) {
        throw 'Windows refused the pointer speed change.'
    }
    if (-not [CSSetup.Native]::SystemParametersInfo($SPI_SETMOUSE, 0, [int[]]@($t1, $t2, $accel), $SPIF_UPDATE)) {
        throw 'Windows refused the pointer precision change.'
    }
}

# ---------------------------------------------------------------- baseline

$BaselineFile = Join-Path $Baseline 'baseline.json'

function Read-Baseline {
    if (Test-Path $BaselineFile) { Get-Content $BaselineFile -Raw | ConvertFrom-Json }
}

# Copies every file a load may change before the first player's load:
# autoexec, cssetup.cfg and the files in each Steam account's CS2 cfg folder.
# Files and folders that appear later belong to a player and are removed on
# restore. Run -SaveBaseline after preparing a PC (for example after CS2's
# first run) to capture it before any player loads.
# Returns $true when this call created the baseline.
function Update-Baseline([string]$steam, $game, [string[]]$userCfgs) {
    if (Read-Baseline) { return $false }
    New-Item -ItemType Directory -Force -Path $Baseline | Out-Null
    $targets = @((Join-Path $game 'game\csgo\cfg\autoexec.cfg'), (Join-Path $game "game\csgo\cfg\$CfgName.cfg"))
    foreach ($dir in $userCfgs) { $targets += @(Get-ChildItem $dir -File | ForEach-Object { $_.FullName }) }
    $files = @()
    foreach ($path in $targets) {
        $copy = $null
        if (Test-Path $path) {
            $copy = "file$($files.Count).bak"
            Copy-Item $path (Join-Path $Baseline $copy) -Force
        }
        $files += [pscustomobject]@{ path = $path; copy = $copy }
    }
    # Written to a temporary file first, so a crash never leaves half a manifest.
    [pscustomobject]@{ created = (Get-Date).ToString('o'); steamRoot = $steam; mouse = Get-WindowsMouse; files = $files } |
        ConvertTo-Json -Depth 5 | Set-Content "$BaselineFile.tmp" -Encoding UTF8
    Move-Item "$BaselineFile.tmp" $BaselineFile -Force
    return $true
}

# Account cfg folders to clean: those under the recorded Steam folder now
# (including ones created since), plus folders listed by older baselines.
function Get-RestoreFolders($state) {
    $folders = @()
    $roots = @()
    if ($state.PSObject.Properties['steamRoot'] -and $state.steamRoot) { $roots += $state.steamRoot }
    if ($state.PSObject.Properties['userCfgs']) {
        foreach ($dir in @($state.userCfgs | Where-Object { $_ })) {
            if (Test-Path $dir) { $folders += $dir }
            # Older baselines: <steam>\userdata\<id>\730\<local|remote>\cfg -> <steam>
            $roots += (Split-Path (Split-Path (Split-Path (Split-Path (Split-Path $dir)))))
        }
    }
    foreach ($root in @($roots | Sort-Object -Unique)) { $folders += @(Get-UserCfgFolders $root) }
    @($folders | Sort-Object -Unique)
}

# Puts every recorded file and the Windows mouse back to the baseline, and
# removes every other file in the Steam accounts' CS2 cfg folders, including
# folders created since (they belong to a player). Keeps the baseline.
# Carries on past a file it cannot restore, then reports every failure.
function Restore-Station {
    $state = Read-Baseline
    if (-not $state) { return $false }
    if (Test-Cs2Running) { throw 'Close Counter-Strike 2 first.' }
    $failed = @()
    $known = @{}
    foreach ($entry in @($state.files)) {
        $known[$entry.path.ToLowerInvariant()] = $true
        try {
            if ($entry.copy) { Copy-Item (Join-Path $Baseline $entry.copy) $entry.path -Force -ErrorAction Stop }
            elseif (Test-Path $entry.path) { Remove-Item $entry.path -Force -ErrorAction Stop }
        } catch { $failed += $entry.path }
    }
    foreach ($dir in (Get-RestoreFolders $state)) {
        foreach ($extra in @(Get-ChildItem $dir -File | Where-Object { -not $known.ContainsKey($_.FullName.ToLowerInvariant()) })) {
            try { Remove-Item $extra.FullName -Force -ErrorAction Stop } catch { $failed += $extra.FullName }
        }
    }
    $m = $state.mouse
    Set-WindowsMouse $m.pointerSpeed $m.threshold1 $m.threshold2 $m.acceleration
    if ($failed) { throw "Could not restore $($failed -join ', ')" }
    return $true
}

# Admin step: capture this PC as it is now. Refused while a player's setup is
# loaded, because the baseline would then contain that player's settings.
function Save-StationBaseline {
    if (Read-Baseline) { throw "A player's setup is loaded. Reset this PC first, then save the baseline." }
    if (Test-Cs2Running) { throw 'Close Counter-Strike 2 first.' }
    $steam = Get-SteamRoot
    [void](Update-Baseline $steam (Get-Cs2Folder $steam) @(Get-UserCfgFolders $steam))
    return 'Saved this PC as the station baseline.'
}

function Restore-Baseline {
    if (-not (Restore-Station)) { return 'Nothing to reset: no profile has been loaded on this PC.' }
    Remove-Item $Baseline -Recurse -Force
    Remove-Item (Join-Path $StateDir 'current.json') -ErrorAction SilentlyContinue
    return 'Station reset to its original settings.'
}

# ---------------------------------------------------------------- apply

# Setups this PC has loaded or prefetched, kept signed, so a load still works
# while the server is down.
function Save-CachedBundle([string]$code, [byte[]]$bytes, [string]$signature) {
    New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
    [pscustomobject]@{ saved = (Get-Date).ToString('o'); dpi = $StationDpi; signature = $signature; body = [Convert]::ToBase64String($bytes) } |
        ConvertTo-Json | Set-Content (Join-Path $CacheDir "$code.json") -Encoding UTF8
}

function Read-CachedBundle([string]$code) {
    $file = Join-Path $CacheDir "$code.json"
    if (-not (Test-Path $file)) { return $null }
    try {
        $entry = Get-Content $file -Raw | ConvertFrom-Json
        $bytes = [Convert]::FromBase64String($entry.body)
        if (-not (Test-Signature $bytes $entry.signature)) { return $null }
        $bundle = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
        $note = "! The server is unreachable: loaded the copy of this setup saved on this PC at $(([datetime]$entry.saved).ToString('HH:mm, d MMM')). Changes made after that are missing."
        if ([int]$entry.dpi -ne $StationDpi) { $note += ' It was converted for a different mouse DPI; ask the admin.' }
        $bundle | Add-Member -NotePropertyName cachedNote -NotePropertyValue $note
        return $bundle
    } catch { return $null }
}

# Downloads a setup and checks its signature. Falls back to the cache only
# when the server cannot be reached (never for an unknown or outdated code).
function Get-Bundle([string]$code) {
    if ($code -notmatch '^\d{6}$') { throw 'Codes are 6 digits.' }
    $query = if ($StationDpi -gt 0) { "?dpi=$StationDpi" } else { '' }
    try {
        $r = Invoke-WebRequest -Uri "$($Server.TrimEnd('/'))/api/profiles/$code/station$query" -TimeoutSec 15 -UseBasicParsing
    } catch {
        $status = $null
        if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq 404) { throw "No setup found for code $code. Check the number on your phone." }
        if ($status -eq 409) { throw "Setup $code was saved by an older version. Open it on your phone and save it again." }
        if ($status -eq 429) { throw 'The server is busy. Wait a minute and try again.' }
        $cached = Read-CachedBundle $code
        if ($cached) { return $cached }
        throw "Could not reach the Loadout server at $Server. Ask the admin."
    }
    $bytes = $r.RawContentStream.ToArray()
    $signature = [string]$r.Headers['X-Loadout-Signature']
    if (-not (Test-Signature $bytes $signature)) {
        throw "The setup from $Server failed its signature check, so it was not applied. Admin: download Loadout.cmd again from the server's admin page."
    }
    $bundle = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
    if ($bundle.PSObject.Properties['game'] -and $bundle.game -ne 'cs2') { throw "Setup $code is for $($bundle.game), not Counter-Strike 2." }
    try { Save-CachedBundle $code $bytes $signature } catch { }
    return $bundle
}

function Set-VideoSettings([string]$path, $values) {
    $text = [IO.File]::ReadAllText($path)
    $nl = if ($text -match "`r`n") { "`r`n" } else { "`n" }   # keep the file's own line endings
    foreach ($p in $values.PSObject.Properties) {
        $pattern = '("' + [regex]::Escape($p.Name) + '"\s+)"[^"]*"'
        if ($text -match $pattern) {
            $text = [regex]::Replace($text, $pattern, ('${1}"' + $p.Value + '"'))
        } else {
            $text = $text -replace '\}\s*$', ("`t`"$($p.Name)`"`t`t`"$($p.Value)`"$nl}$nl")
        }
    }
    [IO.File]::WriteAllText($path, $text, (New-Object Text.ASCIIEncoding))
}

# Report lines: "! " marks a warning, "i " marks information for the player.
function Invoke-Apply([string]$code, [scriptblock]$report) {
    if (-not $report) { $report = { param($m) Write-Host $m } }
    if (Test-Cs2Running) { throw 'Counter-Strike 2 is running. Close it, then load your code.' }
    $bundle = Get-Bundle $code
    & $report "Found setup $code"
    $steam = Get-SteamRoot
    $game = Get-Cs2Folder $steam
    $userCfgs = @(Get-UserCfgFolders $steam)
    if (Update-Baseline $steam $game $userCfgs) { & $report 'Saved the station baseline for reset' }
    try {
        # Every load starts from the station baseline, so nothing of the previous player survives.
        if (-not (Restore-Station)) { throw 'the station baseline disappeared during the load' }
        $cfgDir = Join-Path $game 'game\csgo\cfg'
        $utf8 = New-Object Text.UTF8Encoding $false
        [IO.File]::WriteAllText((Join-Path $cfgDir "$CfgName.cfg"), $bundle.cfg, $utf8)
        $autoexec = Join-Path $cfgDir 'autoexec.cfg'
        $base = if (Test-Path $autoexec) { [IO.File]::ReadAllText($autoexec).TrimEnd() } else { '' }
        [IO.File]::WriteAllText($autoexec, ("$base`r`nexec $CfgName // Loadout`r`n").TrimStart(), $utf8)
        & $report "Wrote $CfgName.cfg for $($bundle.name)"

        if ($bundle.video) {
            $videos = @($userCfgs | ForEach-Object { Join-Path $_ 'cs2_video.txt' } | Where-Object { Test-Path $_ })
            foreach ($video in $videos) { Set-VideoSettings $video $bundle.video }
            $v = $bundle.video
            if ($videos.Count) { & $report "Set video to $($v.'setting.defaultres')x$($v.'setting.defaultresheight')" }
            else { & $report '! Resolution not set: CS2 is not set up on this PC yet. Admin: reset this PC, start CS2 once and quit, then load the code again.' }
        }
        if ($bundle.windowsMouse) {
            $wm = $bundle.windowsMouse
            if ($wm.enhancePointerPrecision) { Set-WindowsMouse $wm.pointerSpeed 6 10 1 } else { Set-WindowsMouse $wm.pointerSpeed 0 0 0 }
            $epp = if ($wm.enhancePointerPrecision) { 'on' } else { 'off' }
            & $report "Windows pointer speed $($wm.pointerSpeed)/20, pointer precision $epp"
        }
        if ($bundle.crosshairCode) {
            try { Set-Clipboard -Value $bundle.crosshairCode } catch { & $report "! Could not copy the crosshair code: $($bundle.crosshairCode)" }
        }
        $bundle | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $StateDir 'current.json') -Encoding UTF8
    } catch {
        $problem = $_.Exception.Message
        try { [void](Restore-Station) } catch { $problem += " (and restoring the station failed: $($_.Exception.Message))" }
        throw "Load failed, station settings restored: $problem"
    }
    if ($bundle.PSObject.Properties['cachedNote']) { & $report $bundle.cachedNote }
    foreach ($warning in @($bundle.warnings)) { & $report "! $warning" }
    foreach ($note in @($bundle.notes)) { & $report "i $note" }
    return $bundle
}

function Start-Cs2 {
    $steamExe = Join-Path (Get-SteamRoot) 'steam.exe'
    if (-not (Test-Path $steamExe)) { throw 'steam.exe not found.' }
    # +exec runs after the game's own config, so the profile always wins.
    Start-Process $steamExe -ArgumentList '-applaunch', '730', '+exec', $CfgName
}

# ---------------------------------------------------------------- readiness

# Steam keeps the per-game cloud switch in each account's sharedconfig.vdf
# (Apps > 730 > cloudenabled). Returns 'off', 'on' or 'unknown'.
function Get-Cs2CloudSetting([string]$steam) {
    $states = @(Get-ChildItem (Join-Path $steam 'userdata') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $vdf = Join-Path $_.FullName '7\remote\sharedconfig.vdf'
        if (Test-Path $vdf) {
            $m = [regex]::Match((Get-Content $vdf -Raw), '"730"\s*\{(?:[^{}]|\{[^{}]*\})*?"cloudenabled"\s*"(\d)"', 'IgnoreCase')
            if ($m.Success) { if ($m.Groups[1].Value -eq '0') { 'off' } else { 'on' } } else { 'unknown' }
        }
    })
    if ($states -contains 'on') { return 'on' }
    if ($states.Count -and -not ($states -contains 'unknown')) { return 'off' }
    return 'unknown'
}

# Everything an admin should know before players arrive. Each item: status
# (OK, WARN, FAIL), what was checked, and what to do.
function Get-Readiness {
    $items = New-Object System.Collections.ArrayList
    function Add([string]$status, [string]$item, [string]$detail) { [void]$items.Add([pscustomobject]@{ status = $status; item = $item; detail = $detail }) }
    if ($SigningKey -like '<RSAKeyValue>*') { Add 'OK' 'Station app' "downloaded from $Server (key $KeyFingerprint)" }
    else { Add 'FAIL' 'Station app' 'not downloaded from a Loadout server: get Loadout.cmd from the admin page' }
    try { Invoke-WebRequest "$($Server.TrimEnd('/'))/api/health" -UseBasicParsing -TimeoutSec 5 | Out-Null; Add 'OK' 'Server' "reachable at $Server" }
    catch { Add 'WARN' 'Server' "unreachable at $Server; only setups cached on this PC will load" }
    if ($StationDpi -gt 0) { Add 'OK' 'Mouse DPI' "$StationDpi DPI; players' sensitivity is converted" }
    else { Add 'FAIL' 'Mouse DPI' 'not set: run Loadout.cmd -MouseDpi <the DPI every station mouse uses>' }
    $steam = $null
    try { $steam = Get-SteamRoot; Add 'OK' 'Steam' $steam } catch { Add 'FAIL' 'Steam' $_.Exception.Message }
    if ($steam) {
        try { $game = Get-Cs2Folder $steam; Add 'OK' 'Counter-Strike 2' $game } catch { Add 'FAIL' 'Counter-Strike 2' $_.Exception.Message }
        $active = (Get-ItemProperty 'HKCU:\Software\Valve\Steam\ActiveProcess' -ErrorAction SilentlyContinue)
        if ($active -and $active.PSObject.Properties['ActiveUser'] -and $active.ActiveUser) { Add 'OK' 'Steam account' 'signed in' }
        else { Add 'WARN' 'Steam account' 'Steam is not running or nobody is signed in: sign in to the station account' }
        $videos = @(Get-UserCfgFolders $steam | ForEach-Object { Join-Path $_ 'cs2_video.txt' } | Where-Object { Test-Path $_ })
        if ($videos.Count) { Add 'OK' 'CS2 first run' 'video settings file found, so resolutions can be set' }
        else { Add 'FAIL' 'CS2 first run' 'start CS2 once on the station account and quit, so players get their resolution' }
        $cloud = Get-Cs2CloudSetting $steam
        if ($cloud -eq 'off' -or $CloudOffConfirmed) { Add 'OK' 'Steam Cloud for CS2' $(if ($cloud -eq 'off') { 'off' } else { 'confirmed off by the admin' }) }
        elseif ($cloud -eq 'on') { Add 'FAIL' 'Steam Cloud for CS2' 'on: turn it off (Steam > CS2 > Properties > General), or reset leaves the last player''s settings in the cloud' }
        else { Add 'WARN' 'Steam Cloud for CS2' 'could not tell: turn it off in Steam > CS2 > Properties > General, then run Loadout.cmd -ConfirmCloudOff' }
    }
    try {
        New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
        $probe = Join-Path $StateDir 'write.test'; Set-Content $probe 'ok'; Remove-Item $probe
        Add 'OK' 'Station folder' $StateDir
    } catch { Add 'FAIL' 'Station folder' "cannot write $StateDir" }
    if (Test-Path (Join-Path $StateDir 'current.json')) { Add 'WARN' 'Current player' "a player's setup is loaded: press Reset before the next player" }
    elseif (Read-Baseline) { Add 'OK' 'Baseline' 'saved' }
    else { Add 'OK' 'Baseline' 'saved automatically at the first load (or run -SaveBaseline now)' }
    if (Test-Cs2Running) { Add 'WARN' 'CS2' 'running: players must close it before loading a code' }
    $cached = @(Get-ChildItem $CacheDir -Filter '*.json' -ErrorAction SilentlyContinue).Count
    Add 'OK' 'Offline cache' "$cached setup(s) cached on this PC"
    return ,$items
}

function Invoke-Prefetch([string[]]$codes) {
    $list = @($codes | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ })
    if ($list.Count -eq 1 -and (Test-Path $list[0])) { $list = @((Get-Content $list[0]) -split '[,\s]+' | Where-Object { $_ }) }
    $ok = 0; $failed = @()
    foreach ($c in $list) {
        try { [void](Get-Bundle $c); $ok++ } catch { $failed += "$c ($($_.Exception.Message))" }
    }
    "Cached $ok setup(s) on this PC." + $(if ($failed) { " Not cached: $($failed -join '; ')" } else { '' })
}

# ---------------------------------------------------------------- command line

if ($Check) {
    $report = Get-Readiness
    foreach ($i in $report) { '{0,-5} {1}: {2}' -f $i.status, $i.item, $i.detail }
    try { $report | ConvertTo-Json | Set-Content (Join-Path $StateDir 'readiness.json') -Encoding UTF8 } catch { }
    if (@($report | Where-Object { $_.status -eq 'FAIL' }).Count) { exit 2 }
    exit 0
}

if ($Reset -or $SaveBaseline -or $Code -or $Launch -or $Prefetch) {
    try {
        if ($Prefetch) { Invoke-Prefetch $Prefetch }
        if (($Reset -or $SaveBaseline -or $Code) -and -not (Enter-Station 30000)) { throw 'Another Loadout window or command is busy on this PC. Try again in a moment.' }
        if ($Reset) { Restore-Baseline }
        elseif ($SaveBaseline) { Save-StationBaseline }
        elseif ($Code) { Invoke-Apply $Code | Out-Null }
        if ($Launch) { Start-Cs2 }
    } catch {
        [Console]::Error.WriteLine("Loadout: $($_.Exception.Message)")
        exit 1
    }
    return
}
if ($MouseDpi -gt 0 -or $ConfirmCloudOff) {
    if ($MouseDpi -gt 0) { "Saved: this PC's mouse runs at $MouseDpi DPI." }
    if ($ConfirmCloudOff) { 'Saved: Steam Cloud is off for CS2 on this PC.' }
}

# ---------------------------------------------------------------- window

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
if (-not (Enter-Station 0)) {
    [void][Windows.MessageBox]::Show('Loadout is already open on this PC.', 'Loadout')
    exit 0
}
[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Loadout" Width="1100" Height="720" WindowStartupLocation="CenterScreen"
        Background="#0E1116" FontFamily="Segoe UI" Foreground="#E8ECF2">
  <Window.Resources>
    <Style TargetType="Button" x:Key="Primary">
      <Setter Property="Foreground" Value="#111"/>
      <Setter Property="Background" Value="#F5A524"/>
      <Setter Property="FontSize" Value="22"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" CornerRadius="10" Padding="28,14">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Opacity" Value="0.88"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.35"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="Button" x:Key="Ghost" BasedOn="{StaticResource Primary}">
      <Setter Property="Background" Value="#1C222C"/>
      <Setter Property="Foreground" Value="#C9D1DC"/>
      <Setter Property="FontSize" Value="16"/>
    </Style>
  </Window.Resources>
  <Grid Margin="56,40">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>
    <DockPanel Grid.Row="0">
      <Border x:Name="ReadyBanner" DockPanel.Dock="Bottom" Background="#3A2A0A" BorderBrush="#F5A524" BorderThickness="1" CornerRadius="8" Padding="14,8" Margin="0,14,0,0" Visibility="Collapsed">
        <TextBlock x:Name="ReadyText" Foreground="#F5C46B" FontSize="14" TextWrapping="Wrap"/>
      </Border>
      <StackPanel Orientation="Horizontal" DockPanel.Dock="Left">
        <Border Width="14" Height="14" CornerRadius="3" Background="#F5A524" Margin="0,0,12,0"/>
        <TextBlock Text="LOADOUT" FontSize="18" FontWeight="Bold" Foreground="#E8ECF2"/>
        <TextBlock Text="  station" FontSize="18" Foreground="#7C8796"/>
      </StackPanel>
      <TextBlock x:Name="ServerText" DockPanel.Dock="Right" HorizontalAlignment="Right" Foreground="#5C6675" FontSize="13" VerticalAlignment="Center"/>
    </DockPanel>
    <Grid Grid.Row="1" VerticalAlignment="Center">
      <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="40"/><ColumnDefinition Width="400"/></Grid.ColumnDefinitions>
      <StackPanel Grid.Column="0">
        <TextBlock Text="Load your setup" FontSize="48" FontWeight="Bold"/>
        <TextBlock Text="Type the 6-digit code from your phone. Your sensitivity, crosshair, binds, viewmodel and video settings go onto this PC." FontSize="18" Foreground="#9AA5B4" TextWrapping="Wrap" Margin="0,10,0,32" MaxWidth="560" HorizontalAlignment="Left"/>
        <Border Background="#151A22" BorderBrush="#2A3240" BorderThickness="2" CornerRadius="14" Padding="20,6" HorizontalAlignment="Left" Width="440" x:Name="CodeBorder">
          <TextBox x:Name="CodeBox" FontSize="64" FontFamily="Consolas" FontWeight="Bold" Background="Transparent" BorderThickness="0"
                   Foreground="#FFFFFF" CaretBrush="#F5A524" MaxLength="6" HorizontalContentAlignment="Center"/>
        </Border>
        <StackPanel Orientation="Horizontal" Margin="0,24,0,0">
          <Button x:Name="LoadButton" Style="{StaticResource Primary}" Content="Load setup" IsEnabled="False"/>
          <Button x:Name="LaunchButton" Style="{StaticResource Ghost}" Content="Launch CS2" Margin="14,0,0,0" IsEnabled="False"/>
        </StackPanel>
        <TextBlock x:Name="ErrorText" Foreground="#FF6B6B" FontSize="16" Margin="0,18,0,0" TextWrapping="Wrap"/>
      </StackPanel>
      <Border Grid.Column="2" Background="#141920" CornerRadius="16" Padding="26" BorderBrush="#222A35" BorderThickness="1">
        <StackPanel>
          <TextBlock x:Name="PlayerText" Text="No setup loaded" FontSize="24" FontWeight="SemiBold"/>
          <TextBlock x:Name="PlayerSub" Text="Waiting for a code" FontSize="14" Foreground="#7C8796" Margin="0,4,0,18"/>
          <ItemsControl x:Name="StepList">
            <ItemsControl.ItemTemplate>
              <DataTemplate>
                <DockPanel Margin="0,0,0,10">
                  <TextBlock Text="{Binding Icon}" Foreground="{Binding Color}" FontSize="16" FontWeight="Bold" Width="24" DockPanel.Dock="Left"/>
                  <TextBlock Text="{Binding Text}" FontSize="15" Foreground="#C9D1DC" TextWrapping="Wrap"/>
                </DockPanel>
              </DataTemplate>
            </ItemsControl.ItemTemplate>
          </ItemsControl>
        </StackPanel>
      </Border>
    </Grid>
    <DockPanel Grid.Row="2">
      <TextBlock DockPanel.Dock="Left" VerticalAlignment="Center" Foreground="#8B96A5" FontSize="14"
                 Text="Already in game? Open the console and type:  exec cssetup"/>
      <Button x:Name="ResetButton" Style="{StaticResource Ghost}" Content="Done playing - reset this PC" HorizontalAlignment="Right"/>
    </DockPanel>
  </Grid>
</Window>
'@
$window = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $xaml))
$ui = @{}
foreach ($name in 'CodeBox', 'CodeBorder', 'LoadButton', 'LaunchButton', 'ResetButton', 'ErrorText', 'PlayerText', 'PlayerSub', 'StepList', 'ServerText', 'ReadyBanner', 'ReadyText') {
    $ui[$name] = $window.FindName($name)
}
$steps = New-Object System.Collections.ObjectModel.ObservableCollection[object]
function Add-Step([string]$message) {
    $icon = [char]0x2713; $color = '#4ADE80'
    if ($message.StartsWith('! ')) { $icon = '!'; $color = '#F5A524'; $message = $message.Substring(2) }
    elseif ($message.StartsWith('i ')) { $icon = 'i'; $color = '#60A5FA'; $message = $message.Substring(2) }
    $steps.Add([pscustomobject]@{ Icon = [string]$icon; Color = $color; Text = $message })
}
$ui.StepList.ItemsSource = $steps
$ui.ServerText.Text = "$Server   -   key $KeyFingerprint" + $(if ($StationDpi -gt 0) { "   -   mouse $StationDpi DPI" } else { '' })
# Admin hint when the PC is not ready (shown to players too, so staff notice).
try {
    $problems = @(Get-Readiness | Where-Object { $_.status -eq 'FAIL' } | ForEach-Object { "$($_.item): $($_.detail)" })
    if ($problems.Count) {
        $ui.ReadyText.Text = "Station not ready (admin): " + ($problems -join '   |   ')
        $ui.ReadyBanner.Visibility = 'Visible'
    }
} catch { }
if (-not $Windowed) { $window.WindowState = 'Maximized' }

function Update-Ui { $window.Dispatcher.Invoke([Action]{}, 'Background') }
function Show-Error([string]$message) {
    $ui.ErrorText.Text = $message
    $ui.CodeBorder.BorderBrush = '#FF6B6B'
}

$ui.CodeBox.Add_PreviewTextInput({ param($s, $e) if ($e.Text -notmatch '^\d+$') { $e.Handled = $true } })
$ui.CodeBox.Add_TextChanged({
    $ui.LoadButton.IsEnabled = ($ui.CodeBox.Text -match '^\d{6}$')
    $ui.ErrorText.Text = ''
    $ui.CodeBorder.BorderBrush = '#2A3240'
})
# One action at a time: Update-Ui lets clicks through while a load runs.
$ui.Busy = $false
$load = {
    $code = $ui.CodeBox.Text
    if ($ui.Busy -or $code -notmatch '^\d{6}$') { return }
    $ui.Busy = $true
    $ui.ResetButton.IsEnabled = $false; $ui.CodeBox.IsReadOnly = $true
    $steps.Clear(); $ui.ErrorText.Text = ''
    $ui.LaunchButton.IsEnabled = $false
    $ui.LoadButton.IsEnabled = $false; $ui.LoadButton.Content = 'Loading...'
    $ui.PlayerText.Text = "Code $code"; $ui.PlayerSub.Text = 'Applying'
    Update-Ui
    try {
        $bundle = Invoke-Apply $code { param($m) Add-Step $m; Update-Ui }
        $ui.PlayerText.Text = $bundle.name
        $ui.PlayerSub.Text = $(if ($bundle.team) { "$($bundle.team)  -  code $code" } else { "Code $code" })
        $ui.LaunchButton.IsEnabled = $true
        $ui.CodeBorder.BorderBrush = '#4ADE80'
    } catch {
        $ui.PlayerText.Text = 'Not loaded'; $ui.PlayerSub.Text = "Code $code"
        Show-Error $_.Exception.Message
    } finally {
        $ui.Busy = $false
        $ui.ResetButton.IsEnabled = $true; $ui.CodeBox.IsReadOnly = $false
        $ui.LoadButton.Content = 'Load setup'
        $ui.LoadButton.IsEnabled = ($ui.CodeBox.Text -match '^\d{6}$')
    }
}
$ui.LoadButton.Add_Click($load)
$ui.CodeBox.Add_KeyDown({ param($s, $e) if ($e.Key -eq 'Return') { & $load } })
$ui.LaunchButton.Add_Click({
    try { Start-Cs2; Add-Step 'Starting Counter-Strike 2 with your setup' } catch { Show-Error $_.Exception.Message }
})
$ui.ResetButton.Add_Click({
    if ($ui.Busy) { return }
    try {
        $message = Restore-Baseline
        $steps.Clear(); Add-Step $message
        $ui.CodeBox.Text = ''; $ui.PlayerText.Text = 'No setup loaded'; $ui.PlayerSub.Text = 'Waiting for a code'
        $ui.LaunchButton.IsEnabled = $false
    } catch { Show-Error $_.Exception.Message }
})
$window.Add_ContentRendered({ $ui.CodeBox.Focus() | Out-Null })
[void]$window.ShowDialog()
