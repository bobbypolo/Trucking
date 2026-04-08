param(
    [int]$FrontendPort = 3101,
    [int]$BackendPort = 5000,
    [int]$DbPort = 3306
)

$ErrorActionPreference = "Stop"

function Test-PortOpen {
    param([int]$Port)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(1000, $false)
        if ($ok -and $client.Connected) {
            $client.EndConnect($iar) | Out-Null
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

function Wait-HttpOk {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 60
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 800
        }
    }
    return $false
}

function Get-DotEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string]$Key
    )
    if (-not (Test-Path $FilePath)) {
        return $null
    }
    $line = Get-Content $FilePath | Where-Object {
        $_ -match "^\s*$Key=" -and $_ -notmatch "^\s*#"
    } | Select-Object -First 1
    if (-not $line) {
        return $null
    }
    $value = $line.Substring($line.IndexOf("=") + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        return $value.Trim('"')
    }
    if ($value.StartsWith("'") -and $value.EndsWith("'")) {
        return $value.Trim("'")
    }
    return $value
}

function Test-FirebaseTunnelAuth {
    param(
        [Parameter(Mandatory = $true)][string]$TunnelUrl,
        [string]$FirebaseApiKey,
        [string]$Email,
        [string]$Password
    )

    if ([string]::IsNullOrWhiteSpace($FirebaseApiKey)) {
        Write-Warning "Firebase auth probe skipped: FIREBASE_WEB_API_KEY/VITE_FIREBASE_API_KEY missing in .env."
        return
    }
    if ([string]::IsNullOrWhiteSpace($Email) -or [string]::IsNullOrWhiteSpace($Password)) {
        Write-Warning "Firebase auth probe skipped: E2E test credentials missing in .env."
        return
    }

    $endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FirebaseApiKey"
    $headers = @{
        "Content-Type" = "application/json"
        "Origin" = $TunnelUrl
        "Referer" = "$TunnelUrl/"
    }
    $body = @{
        email = $Email
        password = $Password
        returnSecureToken = $true
    } | ConvertTo-Json -Compress

    try {
        $response = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $body -TimeoutSec 20
        if ($response.idToken) {
            Write-Host "Firebase auth probe passed for tunnel origin."
        }
        return
    } catch {
        $firebaseMessage = $null
        $raw = $_.ErrorDetails.Message
        if ($raw) {
            try {
                $parsed = $raw | ConvertFrom-Json
                $firebaseMessage = $parsed.error.message
            } catch {
                $firebaseMessage = $raw
            }
        }
        if ([string]::IsNullOrWhiteSpace($firebaseMessage)) {
            $firebaseMessage = $_.Exception.Message
        }

        if ($firebaseMessage -match "requests-from-referer|UNAUTHORIZED_DOMAIN|INVALID_APP_CREDENTIAL") {
            throw "Firebase blocked the tunnel origin ($TunnelUrl). Add trycloudflare.com or this tunnel host to Firebase Authentication > Authorized domains. Raw Firebase error: $firebaseMessage"
        }
        if ($firebaseMessage -match "INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD") {
            Write-Warning "Firebase auth probe used invalid credentials, so origin allowlist could not be fully verified. Update E2E_TEST_EMAIL/E2E_TEST_PASSWORD in .env if you want strict probe enforcement."
            return
        }
        Write-Warning "Firebase auth probe returned: $firebaseMessage"
    }
}

function Start-IfMissing {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$OutLog,
        [Parameter(Mandatory = $true)][string]$ErrLog
    )
    if (Test-PortOpen -Port $Port) {
        Write-Host "Port $Port already listening. Skipping start."
        return
    }
    if (Test-Path $OutLog) { Remove-Item $OutLog -Force }
    if (Test-Path $ErrLog) { Remove-Item $ErrLog -Force }
    Start-Process -FilePath "npm.cmd" -ArgumentList $Command -WorkingDirectory $WorkingDirectory -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog | Out-Null
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envPath = Join-Path $repoRoot ".env"

$frontendOut = Join-Path $repoRoot "frontend_start_runtime.out.log"
$frontendErr = Join-Path $repoRoot "frontend_start_runtime.err.log"
$backendOut = Join-Path $repoRoot "server_start_runtime.out.log"
$backendErr = Join-Path $repoRoot "server_start_runtime.err.log"
$tunnelOut = Join-Path $repoRoot "cloudflared_tunnel.out.log"
$tunnelErr = Join-Path $repoRoot "cloudflared_tunnel.err.log"

# Ensure local MySQL is reachable, try Docker container bootstrap if needed.
if (-not (Test-PortOpen -Port $DbPort)) {
    try {
        docker start loadpilot-mysql | Out-Null
        Start-Sleep -Seconds 4
    } catch {
        Write-Warning "MySQL is not reachable on $DbPort and Docker start failed. Continue only if your DB is already running elsewhere."
    }
}

if (-not (Test-PortOpen -Port $DbPort)) {
    throw "Database is not reachable on 127.0.0.1:$DbPort"
}

Start-IfMissing -Port $BackendPort -WorkingDirectory (Join-Path $repoRoot "server") -Command "run dev" -OutLog $backendOut -ErrLog $backendErr
if (-not (Wait-HttpOk -Url "http://127.0.0.1:$BackendPort/api/health" -TimeoutSeconds 90)) {
    throw "Backend health check failed on http://127.0.0.1:$BackendPort/api/health"
}

Start-IfMissing -Port $FrontendPort -WorkingDirectory $repoRoot -Command "run dev" -OutLog $frontendOut -ErrLog $frontendErr
if (-not (Wait-HttpOk -Url "http://127.0.0.1:$FrontendPort" -TimeoutSeconds 90)) {
    throw "Frontend check failed on http://127.0.0.1:$FrontendPort"
}

# Replace any stale quick tunnel process.
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path $tunnelOut) { Remove-Item $tunnelOut -Force }
if (Test-Path $tunnelErr) { Remove-Item $tunnelErr -Force }

$cloudflaredPath = (Get-Command cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
if (-not $cloudflaredPath) {
    $fallback = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
    if (Test-Path $fallback) {
        $cloudflaredPath = $fallback
    }
}
if (-not $cloudflaredPath) {
    throw "cloudflared not found in PATH and fallback location missing."
}

Start-Process -FilePath $cloudflaredPath -ArgumentList "tunnel --url http://127.0.0.1:$FrontendPort --no-autoupdate" -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr | Out-Null

$deadline = (Get-Date).AddSeconds(45)
$tunnelUrl = $null
while ((Get-Date) -lt $deadline) {
    if (Test-Path $tunnelErr) {
        $line = Select-String -Path $tunnelErr -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -Last 1
        if ($line) {
            $match = [regex]::Match($line.Line, "https://[a-z0-9-]+\.trycloudflare\.com")
            if ($match.Success) {
                $tunnelUrl = $match.Value
                break
            }
        }
    }
    Start-Sleep -Milliseconds 700
}

if (-not $tunnelUrl) {
    throw "Tunnel URL not found in cloudflared logs ($tunnelErr)."
}

if (-not (Wait-HttpOk -Url $tunnelUrl -TimeoutSeconds 60)) {
    throw "Tunnel URL did not become reachable: $tunnelUrl"
}

if (-not (Wait-HttpOk -Url "$tunnelUrl/api/health" -TimeoutSeconds 60)) {
    throw "Tunnel API health did not become reachable: $tunnelUrl/api/health"
}

$firebaseApiKey = Get-DotEnvValue -FilePath $envPath -Key "FIREBASE_WEB_API_KEY"
if ([string]::IsNullOrWhiteSpace($firebaseApiKey)) {
    $firebaseApiKey = Get-DotEnvValue -FilePath $envPath -Key "VITE_FIREBASE_API_KEY"
}
$probeEmail = Get-DotEnvValue -FilePath $envPath -Key "E2E_TEST_EMAIL"
if ([string]::IsNullOrWhiteSpace($probeEmail)) {
    $probeEmail = Get-DotEnvValue -FilePath $envPath -Key "E2E_ADMIN_EMAIL"
}
$probePassword = Get-DotEnvValue -FilePath $envPath -Key "E2E_TEST_PASSWORD"
if ([string]::IsNullOrWhiteSpace($probePassword)) {
    $probePassword = Get-DotEnvValue -FilePath $envPath -Key "E2E_ADMIN_PASSWORD"
}

Test-FirebaseTunnelAuth -TunnelUrl $tunnelUrl -FirebaseApiKey $firebaseApiKey -Email $probeEmail -Password $probePassword

$firebaseProjectId = Get-DotEnvValue -FilePath $envPath -Key "FIREBASE_PROJECT_ID"
if ([string]::IsNullOrWhiteSpace($firebaseProjectId)) {
    $firebaseProjectId = Get-DotEnvValue -FilePath $envPath -Key "VITE_FIREBASE_PROJECT_ID"
}
$tunnelHost = ([uri]$tunnelUrl).Host

Write-Host ""
Write-Host "Customer Tunnel Ready"
Write-Host "Frontend URL: $tunnelUrl"
Write-Host "Health URL:   $tunnelUrl/api/health"
Write-Host "Login:        $probeEmail / $probePassword"
Write-Host ""
Write-Host "Firebase Auth Domain Checklist:"
Write-Host "  Ensure Firebase Authentication -> Settings -> Authorized domains includes:"
Write-Host "  - trycloudflare.com (recommended for rotating quick tunnel hosts), OR"
Write-Host "  - $tunnelHost"
if (-not [string]::IsNullOrWhiteSpace($firebaseProjectId)) {
    Write-Host "  Console: https://console.firebase.google.com/project/$firebaseProjectId/authentication/settings"
}
Write-Host ""
Write-Host "Logs:"
Write-Host "  Backend:   $backendOut"
Write-Host "  Frontend:  $frontendOut"
Write-Host "  Tunnel:    $tunnelErr"
