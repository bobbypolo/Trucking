# Load environment variables from .env
if (Test-Path ".env") {
    Get-Content .env | Where-Object { $_ -match "=" } | ForEach-Object {
        $name, $value = $_.Split("=", 2)
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

Write-Host "Starting GitHub MCP Server..." -ForegroundColor Cyan
npx -y @modelcontextprotocol/server-github
