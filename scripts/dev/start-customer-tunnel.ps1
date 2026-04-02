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

Write-Host ""
Write-Host "Customer Tunnel Ready"
Write-Host "Frontend URL: $tunnelUrl"
Write-Host "Health URL:   $tunnelUrl/api/health"
Write-Host "Login:        user@loadpilot.com / User123"
Write-Host ""
Write-Host "Logs:"
Write-Host "  Backend:   $backendOut"
Write-Host "  Frontend:  $frontendOut"
Write-Host "  Tunnel:    $tunnelErr"
