$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$TargetIP = "192.168.31.35"

# --- Pre-flight Check: Cleaning Orphaned Processes ---
Write-Host "--- Pre-flight: Checking for orphaned build processes... ---" -ForegroundColor Cyan

$orphans = Get-Process -Name "node", "esbuild" -ErrorAction SilentlyContinue
if ($orphans) {
    Write-Host "Found orphaned processes. Cleaning up..." -ForegroundColor Yellow
    foreach ($p in $orphans) {
        Write-Host "Stopping $($p.ProcessName) (PID: $($p.Id))..." -ForegroundColor DarkGray
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Cleanup complete." -ForegroundColor Green
}

# mDNS/auto-connect tuning:
# - Keep "adb-tls-connect" (paired devices) for safety.
# - If you truly want maximum aggressiveness, you can add ",adb" to also allow _adb._tcp auto-connect:
#   $MdnsAutoConnect = "adb-tls-connect,adb"
$MdnsAutoConnect = "adb-tls-connect"
$ForceOpenScreenMdns = $true

# How long to wait/poll for mDNS discovery before prompting
$MdnsPollSeconds = 6

function Die([string]$msg) {
    Write-Error "FAILED: $msg"
    exit 1
}

function Require-Command([string]$name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Die "Required command not found on PATH: $name"
    }
}

function Exec([string]$file, [string[]]$Arguments = @(), [switch]$IgnoreExitCode) {
    $out = & $file @Arguments 2>&1 | Out-String
    $code = $LASTEXITCODE
    if (-not $IgnoreExitCode -and $code -ne 0) {
        $joined = ($Arguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
        Die "$file $joined failed (exit $code). Output:`n$out"
    }
    return [pscustomobject]@{ Output = $out; ExitCode = $code }
}

function Exec-Live([string]$file, [string[]]$Arguments = @(), [switch]$IgnoreExitCode) {
    Write-Host "Executing: $file $Arguments" -ForegroundColor DarkGray
    & $file @Arguments
    if (-not $IgnoreExitCode -and $LASTEXITCODE -ne 0) {
        Die "$file failed with exit code $LASTEXITCODE"
    }
}

function Get-AdbDevices() {
    $res = Exec "adb" @("devices", "-l") -IgnoreExitCode
    $lines = $res.Output -split "`r?`n" |
        Where-Object { $_ -and $_ -notmatch '^\s*List of devices attached' }

    $devices = @()
    foreach ($line in $lines) {
        if ($line -match '^(?<serial>\S+)\s+(?<state>\S+)\b(?<rest>.*)$') {
            $devices += [pscustomobject]@{
                Serial = $Matches.serial
                State  = $Matches.state
                Raw    = $line.Trim()
            }
        }
    }
    return $devices
}

function Get-AdbMdnsServices() {
    $res = Exec "adb" @("mdns", "services") -IgnoreExitCode
    $lines = $res.Output -split "`r?`n" |
        Where-Object { $_ -and $_ -notmatch '^\s*List of discovered mdns services' }

    $svcs = @()
    foreach ($line in $lines) {
        # Typical format:
        # adb-xxxxxxx    _adb-tls-connect._tcp   192.168.1.2:6666
        if ($line -match '^(?<name>\S+)\s+(?<type>_adb[^ ]+)\s+(?<ip>\d{1,3}(?:\.\d{1,3}){3}):(?<port>\d+)\s*$') {
            $svcs += [pscustomobject]@{
                Name = $Matches.name
                Type = $Matches.type.TrimEnd('.')
                IP   = $Matches.ip
                Port = [int]$Matches.port
                Raw  = $line.Trim()
            }
        }
    }
    return $svcs
}

function Find-TargetMdnsEndpoint([string]$ip) {
    $svcs = Get-AdbMdnsServices
    $match = $svcs | Where-Object { $_.IP -eq $ip -and $_.Type -match '_adb-tls-connect\._tcp$' } | Select-Object -First 1
    if (-not $match) { return $null }
    return [pscustomobject]@{
        Name     = $match.Name
        Endpoint = "$($match.IP):$($match.Port)"
        Port     = $match.Port
        Raw      = $match.Raw
    }
}

function Test-TargetConnected([string]$ip, [string]$endpoint, [string]$mdnsName) {
    $devices = Get-AdbDevices
    foreach ($d in $devices) {
        if ($d.State -ne "device") { continue }

        # Common cases:
        # - Serial is "ip:port"
        # - Serial is an mDNS instance name
        if ($endpoint -and $d.Serial -eq $endpoint) { return $true }
        if ($mdnsName -and $d.Serial -eq $mdnsName) { return $true }
        if ($d.Serial -like "$ip`:*") { return $true }
    }
    return $false
}

function Resolve-TargetSerial([string]$ip, [string]$endpoint, [string]$mdnsName) {
    $devices = Get-AdbDevices | Where-Object { $_.State -eq "device" }

    if ($endpoint) {
        $hit = $devices | Where-Object { $_.Serial -eq $endpoint } | Select-Object -First 1
        if ($hit) { return $hit.Serial }
    }
    if ($mdnsName) {
        $hit = $devices | Where-Object { $_.Serial -eq $mdnsName } | Select-Object -First 1
        if ($hit) { return $hit.Serial }
    }
    $hit = $devices | Where-Object { $_.Serial -like "$ip`:*" } | Select-Object -First 1
    if ($hit) { return $hit.Serial }

    if ($devices.Count -eq 1) {
        Write-Warning "Target not uniquely identifiable; using the only connected device: $($devices[0].Serial)"
        return $devices[0].Serial
    }

    if ($devices.Count -gt 1) {
        Write-Warning "Multiple devices connected and target not uniquely identifiable."
        $i = 0
        foreach ($d in $devices) {
            Write-Host ("[{0}] {1}" -f $i, $d.Raw) -ForegroundColor Gray
            $i++
        }
        $choice = Read-Host "Enter the index of the device to use"
        if ($choice -match '^\d+$' -and [int]$choice -ge 0 -and [int]$choice -lt $devices.Count) {
            return $devices[[int]$choice].Serial
        }
        Die "Invalid selection."
    }

    return $null
}

function Configure-AdbAggressiveMdns() {
    Write-Host "Configuring ADB mDNS settings..." -ForegroundColor Gray
    
    $env:ADB_MDNS_AUTO_CONNECT = $MdnsAutoConnect
    if ($ForceOpenScreenMdns) {
        $env:ADB_MDNS_OPENSCREEN = "1"
    }

    # Ensure server inherits env vars
    Write-Host "Restarting ADB server to apply settings..." -ForegroundColor Gray
    
    Write-Host "  [1/3] Killing existing server..." -ForegroundColor DarkGray
    Start-Process -FilePath "adb" -ArgumentList "kill-server" -NoNewWindow -Wait
    
    Write-Host "  [2/3] Starting server..." -ForegroundColor DarkGray
    Start-Process -FilePath "adb" -ArgumentList "start-server" -NoNewWindow
    Start-Sleep -Seconds 3

    Write-Host "  [3/3] Checking mDNS status..." -ForegroundColor DarkGray
    $check = Exec "adb" @("mdns", "check") -IgnoreExitCode
    $msg = $check.Output.Trim()
    if ($msg) {
        Write-Host "ADB mDNS: $msg" -ForegroundColor DarkGray
    }
}

function Try-Connect([string]$endpoint) {
    if (-not $endpoint) { return $false }
    Write-Host "Attempting adb connect $endpoint ..." -ForegroundColor Yellow
    $res = Exec "adb" @("connect", $endpoint) -IgnoreExitCode
    Write-Host ($res.Output.Trim()) -ForegroundColor Gray
    return ($res.Output -match 'connected to' -or $res.Output -match 'already connected to')
}

function Ensure-TargetConnectedAndGetSerial([string]$ip, [string]$portCachePath) {
    Configure-AdbAggressiveMdns

    Write-Host "Checking for existing mDNS discovery..." -ForegroundColor Gray
    
    # 1) If already connected (by any name/serial), keep it.
    $ep0 = Find-TargetMdnsEndpoint $ip
    $endpoint0 = if ($ep0) { $ep0.Endpoint } else { $null }
    $mdnsName0  = if ($ep0) { $ep0.Name } else { $null }

    if (Test-TargetConnected $ip $endpoint0 $mdnsName0) {
        $serial = Resolve-TargetSerial $ip $endpoint0 $mdnsName0
        if ($serial) { return $serial }
    }

    Write-Host "Checking cached connection port..." -ForegroundColor Gray
    
    # 2) If we have a cached port, try it early (fast path).
    $cachedPort = $null
    if (Test-Path $portCachePath) {
        $raw = (Get-Content $portCachePath -ErrorAction SilentlyContinue | Select-Object -First 1)
        if ($raw -match '^\s*(\d{2,5})\s*$') { $cachedPort = $Matches[1] }
    }
    if ($cachedPort) {
        if (Try-Connect "$ip`:$cachedPort") {
            return "$ip`:$cachedPort"
        }
    }

    Write-Host "Polling for device availability (Timeout: ${MdnsPollSeconds}s)..." -ForegroundColor Gray
    
    # 3) Kick reconnects, then re-check/poll for mDNS + connect.
    Exec "adb" @("reconnect", "offline") -IgnoreExitCode | Out-Null
    Exec "adb" @("reconnect") -IgnoreExitCode | Out-Null

    $deadline = (Get-Date).AddSeconds($MdnsPollSeconds)
    do {
        $ep = Find-TargetMdnsEndpoint $ip
        if ($ep) {
            # Even if auto-connect is enabled, explicitly connecting is harmless ("already connected").
            if (Try-Connect $ep.Endpoint) {
                if ($ep.Port) { Set-Content -Path $portCachePath -Value $ep.Port -Encoding ASCII }
                return $ep.Endpoint
            }

            # Auto-connect might have connected using a non ip:port serial; try resolving.
            if (Test-TargetConnected $ip $ep.Endpoint $ep.Name) {
                $serial = Resolve-TargetSerial $ip $ep.Endpoint $ep.Name
                if ($serial) {
                    if ($ep.Port) { Set-Content -Path $portCachePath -Value $ep.Port -Encoding ASCII }
                    return $serial
                }
            }
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    # 4) Manual flow: pair or connect-port prompt.
    Write-Warning "Device $ip still not connected/discoverable via mDNS."
    $input = Read-Host "Enter CONNECT Port (from Developer Options), or type 'pair' to pair a new device"

    if ($input -eq "pair") {
        $pairPort = Read-Host "Enter PAIRING Port"
        Write-Host "Running adb pair..." -ForegroundColor Yellow
        Write-Host "Please enter the Wi-Fi pairing code when prompted below." -ForegroundColor Gray
        Exec "adb" @("pair", "$ip`:$pairPort") -IgnoreExitCode | Out-Null

        # After pairing, prefer mDNS discovery (ports can be different from what user expects).
        $deadline2 = (Get-Date).AddSeconds($MdnsPollSeconds)
        do {
            $ep2 = Find-TargetMdnsEndpoint $ip
            if ($ep2 -and (Try-Connect $ep2.Endpoint)) {
                if ($ep2.Port) { Set-Content -Path $portCachePath -Value $ep2.Port -Encoding ASCII }
                return $ep2.Endpoint
            }
            Start-Sleep -Milliseconds 500
        } while ((Get-Date) -lt $deadline2)

        $connectPort = Read-Host "Pairing complete. Now enter the CONNECT Port"
    } else {
        $connectPort = $input
    }

    while ($true) {
        if ([string]::IsNullOrWhiteSpace($connectPort)) {
            $connectPort = Read-Host "Enter CONNECT Port"
        }

        if ($connectPort -notmatch '^\d{2,5}$') {
            Write-Warning "Port must be numeric."
            $connectPort = Read-Host "Enter CONNECT Port"
            continue
        }

        $endpoint = "$ip`:$connectPort"
        if (Try-Connect $endpoint) {
            Set-Content -Path $portCachePath -Value $connectPort -Encoding ASCII
            return $endpoint
        }

        Write-Warning "Connection failed."
        $connectPort = Read-Host "Enter Correct Port to try again (or Ctrl+C to cancel)"
    }
}

# ---- Preconditions ----
Require-Command "adb"
Require-Command "npm"
Require-Command "npx"

# 1. Detect Root
$root = (Get-Location).Path
if (!(Test-Path (Join-Path $root "package.json")) -or !(Test-Path (Join-Path $root "android"))) {
    Die "Please run this script from the project root (containing package.json and android/)."
}

$portCachePath = Join-Path $root ".adb-wifi-connect-port.txt"

# 2. ADB Connection Check (robust + aggressive auto-connect)
Write-Host "--- [0/6] Checking ADB Connection ---" -ForegroundColor Cyan
$TargetSerial = Ensure-TargetConnectedAndGetSerial $TargetIP $portCachePath
if (-not $TargetSerial) { Die "Could not determine a usable adb serial for the target device." }
Write-Host "Using ADB device: $TargetSerial" -ForegroundColor Green

# 3. Clean Android
Write-Host "--- [1/6] Cleaning Android Build ---" -ForegroundColor Cyan
Push-Location (Join-Path $root "android")
try {
    Exec-Live ".\gradlew" @("clean")
} finally { Pop-Location }

# 4. Install Dependencies
Write-Host "--- [2/6] Installing Dependencies ---" -ForegroundColor Cyan
Exec-Live "npm" @("install")

# 5. Build Web Assets
Write-Host "--- [3/6] Building Web Assets ---" -ForegroundColor Cyan
Exec-Live "npm" @("run", "build")

# 6. Sync Capacitor
Write-Host "--- [4/6] Syncing Capacitor ---" -ForegroundColor Cyan
Exec-Live "npx" @("cap", "sync")

# 7. Assemble Debug APK
Write-Host "--- [5/6] Assembling APK ---" -ForegroundColor Cyan
Push-Location (Join-Path $root "android")
try {
    Exec-Live ".\gradlew" @("assembleDebug")
} finally { Pop-Location }

# 8. Install & Run (always target the chosen serial to avoid "more than one device")
Write-Host "--- [6/6] Installing & Launching ---" -ForegroundColor Cyan
$apkPath = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"

if (Test-Path $apkPath) {
    Write-Host "Installing APK to device..." -ForegroundColor Yellow
    Exec-Live "adb" @("-s", $TargetSerial, "install", "-r", $apkPath)

    Write-Host "Launching App..." -ForegroundColor Yellow
    Exec-Live "adb" @("-s", $TargetSerial, "shell", "am", "start", "-n", "com.steirische.simulator/.MainActivity")
    Start-Sleep -Seconds 2

    Write-Host "SUCCESS: Launching scrcpy..." -ForegroundColor Green
    if (Get-Command "scrcpy" -ErrorAction SilentlyContinue) {
        # Use AAC codec to improve compatibility with Android 16 / Sony devices
        Exec-Live "scrcpy" @("-s", $TargetSerial, "--audio-codec=aac", "--audio-bit-rate=128K") -IgnoreExitCode
    } else {
        Write-Warning "scrcpy not found on PATH; skipping screen mirror."
    }
} else {
    Die "APK file not found at $apkPath"
}
