$ErrorActionPreference = 'Stop'

function Die ($msg) {
    Write-Error "FAILED: $msg"
    exit 1
}

# 1. Detect Root
$root = Get-Location
if (!(Test-Path "$root\package.json") -or !(Test-Path "$root\android")) {
    Die "Please run this script from the project root (containing package.json and android/)."
}

# 2. Clean Android
Write-Host "--- [1/5] Cleaning Android Build ---" -ForegroundColor Cyan
Push-Location "$root\android"
try {
    .\gradlew clean
    if ($LASTEXITCODE -ne 0) { Die "gradlew clean failed" }
} finally { Pop-Location }

# 3. Install Dependencies
Write-Host "--- [2/5] Installing Dependencies ---" -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { Die "npm install failed" }

# 4. Build Web Assets
Write-Host "--- [3/5] Building Web Assets ---" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Die "npm run build failed" }

# 5. Sync Capacitor
Write-Host "--- [4/5] Syncing Capacitor ---" -ForegroundColor Cyan
npx cap sync
if ($LASTEXITCODE -ne 0) { Die "npx cap sync failed" }

# 6. Assemble Debug APK
Write-Host "--- [5/5] Assembling APK ---" -ForegroundColor Cyan
Push-Location "$root\android"
try {
    .\gradlew assembleDebug
    if ($LASTEXITCODE -ne 0) { Die "gradlew assembleDebug failed" }
} finally { Pop-Location }

# 7. Copy to Drive (Staged)
$src = "$root\android\app\build\outputs\apk\debug\app-debug.apk"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fileName = "Steirische-v1.1-$timestamp.apk"
$driveDir = "G:\My Drive\Steirische Simulator"
$drivePath = "$driveDir\$fileName"

# 1. Local Staging (Crucial to break file locks)
$localStageDir = "$root\dist_apk"
if (!(Test-Path $localStageDir)) { New-Item -ItemType Directory -Force -Path $localStageDir | Out-Null }
$localPath = "$localStageDir\$fileName"

if (Test-Path $src) {
    # Step A: Copy to local folder first
    Write-Host "--- [1/2] Staging to $localPath ---" -ForegroundColor Cyan
    Copy-Item -Force $src $localPath
    
    # Wait for OS to flush file
    Start-Sleep -Seconds 2
    
    $stageFile = Get-Item $localPath
    if ($stageFile.Length -lt 1024) { Die "Build failed: APK is empty." }

    # Step B: Copy to Drive
    if (Test-Path $driveDir) {
        Write-Host "--- [2/2] Copying to Google Drive ---" -ForegroundColor Cyan
        
        # Use native copy for stability
        cmd /c copy /Y /B "$localPath" "$drivePath" | Out-Null
        
        Write-Host "SUCCESS: APK queued for upload." -ForegroundColor Green
        Write-Host "File: $fileName" -ForegroundColor Gray
        Write-Host "IMPORTANT: Wait for the green checkmark in Drive before opening!" -ForegroundColor Yellow
    } else {
        Write-Warning "Google Drive folder not found at: $driveDir"
        Write-Host "APK is available locally at: $localPath" -ForegroundColor Green
    }

    # Step C: Copy to OneDrive
    $oneDriveDir = "C:\Users\imede.IME-DEKKER\OneDrive\APK"
    $oneDrivePath = "$oneDriveDir\$fileName"

    if (Test-Path $oneDriveDir) {
        Write-Host "--- [3/3] Copying to OneDrive ---" -ForegroundColor Cyan
        Copy-Item -Force $localPath $oneDrivePath
        Write-Host "SUCCESS: APK copied to OneDrive." -ForegroundColor Green
        Write-Host "Location: $oneDrivePath" -ForegroundColor Gray
    } else {
        Write-Warning "OneDrive folder not found at: $oneDriveDir"
    }
} else {
    Die "APK file not found at $src"
}
