# Development Orchestration Script
# Runs install, build, dev servers, health checks, tests, and commit

param(
    [string]$CommitMessage = "chore: development changes",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$NetServerUrl = "http://localhost:3000",
    [string]$CollabServerUrl = "http://localhost:4000",
    [switch]$SkipCommit = $false
)

$ErrorActionPreference = "Stop"

# Per-service configuration for startup guards
$ServiceConfig = @{
    "NetServer" = @{
        Port = 3000
        HealthCheckUrl = "http://localhost:3000/health"
        MaxStartupWaitSeconds = 30
        PortCheckIntervalSeconds = 1
        InitialWarmupSeconds = 2
    }
    "Platform" = @{
        Port = 5174
        HealthCheckUrl = "http://localhost:5174"
        MaxStartupWaitSeconds = 45
        PortCheckIntervalSeconds = 1
        InitialWarmupSeconds = 3
    }
    "Editor" = @{
        Port = 5173
        HealthCheckUrl = "http://localhost:5173"
        MaxStartupWaitSeconds = 45
        PortCheckIntervalSeconds = 1
        InitialWarmupSeconds = 3
    }
    "CollabServer" = @{
        Port = 4000
        HealthCheckUrl = "http://localhost:4000/health"
        MaxStartupWaitSeconds = 30
        PortCheckIntervalSeconds = 1
        InitialWarmupSeconds = 2
    }
}

# Health check configuration
$HealthCheckConfig = @{
    Database = @{
        MaxRetries = 5
        InitialRetryDelaySeconds = 2
        MaxRetryDelaySeconds = 10
    }
    Server = @{
        MaxRetries = 5
        InitialRetryDelaySeconds = 1
        MaxRetryDelaySeconds = 8
    }
}

# Colors for output
function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "-> $Message" -ForegroundColor Yellow
}

# Helper to run pnpm commands
function Invoke-PnpmCommand {
    param(
        [string]$Command,
        [string]$Description
    )
    Write-Step $Description
    Write-Info "Running: pnpm $Command"
    
    $process = Start-Process -FilePath "pnpm" -ArgumentList $Command -NoNewWindow -Wait -PassThru
    
    $exitCode = if ($process.HasExited) { $process.ExitCode } else { 0 }
    if ($exitCode -ne 0) {
        Write-Error "Failed: pnpm $Command (exit code: $exitCode)"
        throw "pnpm command failed"
    }
    
    Write-Success "Completed: $Description"
}

# Helper to check if a port is open
function Test-PortOpen {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutSeconds = 5
    )
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($HostName, $Port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne([TimeSpan]::FromSeconds($TimeoutSeconds), $false)
        
        if ($wait) {
            $tcpClient.EndConnect($connect)
            $tcpClient.Close()
            return $true
        } else {
            $tcpClient.Close()
            return $false
        }
    } catch {
        return $false
    }
}

# Helper to wait for port readiness
function Wait-ForPortReady {
    param(
        [string]$ServiceName,
        [string]$HostName,
        [int]$Port,
        [int]$MaxWaitSeconds,
        [int]$CheckIntervalSeconds
    )
    
    Write-Info "Waiting for $ServiceName to open port $Port..."
    $elapsed = 0
    $maxWaitMs = $MaxWaitSeconds * 1000
    $checkIntervalMs = $CheckIntervalSeconds * 1000
    
    while ($elapsed -lt $maxWaitMs) {
        if (Test-PortOpen -HostName $HostName -Port $Port -TimeoutSeconds 1) {
            Write-Success "$ServiceName port $Port is ready (waited $($elapsed/1000)s)"
            return $true
        }
        
        Start-Sleep -Milliseconds $checkIntervalMs
        $elapsed += $checkIntervalMs
        
        if (($elapsed % 5000) -eq 0) {
            Write-Info "Still waiting... ($([math]::Round($elapsed/1000))s / $MaxWaitSeconds s)"
        }
    }
    
    Write-Error "$ServiceName port $Port did not become ready within $MaxWaitSeconds seconds"
    return $false
}

# Helper to start dev server in background and wait for readiness
function Start-DevServer {
    param(
        [string]$ScriptName,
        [string]$Description,
        [string]$ServiceKey
    )
    Write-Step "Starting $Description"
    Write-Info "Running: pnpm run $ScriptName"
    
    $process = Start-Process -FilePath "pnpm" -ArgumentList "run", $ScriptName -NoNewWindow -PassThru
    
    if (-not $process) {
        Write-Error "Failed to start $Description"
        throw "Failed to start dev server"
    }
    
    Write-Success "Started $Description (PID: $process.Id)"
    
    # Initial warmup period
    $config = $ServiceConfig[$ServiceKey]
    if ($config.InitialWarmupSeconds -gt 0) {
        Write-Info "Warming up for $($config.InitialWarmupSeconds) seconds..."
        Start-Sleep -Seconds $config.InitialWarmupSeconds
    }
    
    # Wait for port to be ready
    $portReady = Wait-ForPortReady `
        -ServiceName $Description `
        -HostName "localhost" `
        -Port $config.Port `
        -MaxWaitSeconds $config.MaxStartupWaitSeconds `
        -CheckIntervalSeconds $config.PortCheckIntervalSeconds
    
    if (-not $portReady) {
        Write-Error "$Description failed to become ready"
        throw "$Description startup timeout"
    }
    
    return $process
}

# Health check functions
function Test-DatabaseConnection {
    param(
        [string]$HostName,
        [int]$Port
    )
    Write-Step "Checking database connection"
    Write-Info "Testing connection to ${HostName}:${Port}"
    
    $config = $HealthCheckConfig.Database
    $maxRetries = $config.MaxRetries
    $initialDelay = $config.InitialRetryDelaySeconds
    $maxDelay = $config.MaxRetryDelaySeconds
    
    $attempt = 1
    while ($attempt -le $maxRetries) {
        $errorMsg = $null
        
        $result = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue -ErrorVariable netError
        
        if ($netError) {
            $errorMsg = $netError[0].Exception.Message
        } elseif ($result -and $result.TcpTestSucceeded) {
            if ($attempt -gt 1) {
                Write-Success "Database connection successful (succeeded on attempt $attempt)"
            } else {
                Write-Success "Database connection successful"
            }
            return $true
        } else {
            $errorMsg = "TCP test did not succeed"
        }
        
        if ($errorMsg) {
            if ($attempt -lt $maxRetries) {
                # Exponential backoff: delay = min(initialDelay * 2^(attempt-1), maxDelay)
                $power = [System.Math]::Pow(2, $attempt - 1)
                $delay = [System.Math]::Min($initialDelay * $power, $maxDelay)
                $delay = [System.Math]::Round($delay)
                
                Write-Info "Attempt $attempt/$maxRetries failed: $errorMsg"
                Write-Info "Retrying in $delay seconds (exponential backoff)..."
                Start-Sleep -Seconds $delay
                $attempt++
            } else {
                Write-Error "Database connection failed after $maxRetries attempts: $errorMsg"
                Write-Info "Troubleshooting tips:"
                Write-Info "  - Ensure PostgreSQL is running: docker-compose up db"
                Write-Info "  - Check DATABASE_URL environment variable is set"
                Write-Info "  - Verify port $Port is not blocked by firewall"
                Write-Info "  - Test manually: Test-NetConnection -ComputerName $HostName -Port $Port"
                return $false
            }
        } else {
            $attempt++
        }
    }
    
    return $false
}

function Test-ServerHealth {
    param(
        [string]$Url,
        [string]$ServiceName
    )
    Write-Step "Checking $ServiceName connection"
    Write-Info "Testing: $Url/health"
    
    $config = $HealthCheckConfig.Server
    $maxRetries = $config.MaxRetries
    $initialDelay = $config.InitialRetryDelaySeconds
    $maxDelay = $config.MaxRetryDelaySeconds
    
    $attempt = 1
    while ($attempt -le $maxRetries) {
        $errorMsg = $null
        $isTimeout = $false
        
        if ($Url -notmatch "/health$") {
            $healthUrl = "$Url/health"
        } else {
            $healthUrl = $Url
        }
        
        $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue -ErrorVariable webError
        
        if ($webError) {
            $errorMsg = $webError[0].Exception.Message
            $isTimeout = ($errorMsg -match "timeout") -or ($errorMsg -match "timed out") -or ($errorMsg -match "Unable to connect")
        } elseif ($response -and $response.StatusCode -eq 200) {
            if ($attempt -gt 1) {
                Write-Success "$ServiceName is healthy (HTTP 200, succeeded on attempt $attempt)"
            } else {
                Write-Success "$ServiceName is healthy (HTTP 200)"
            }
            return $true
        } elseif ($response -and $response.StatusCode -ne 200) {
            Write-Error "$ServiceName health check failed: HTTP $($response.StatusCode)"
            Write-Info "Server responded but returned non-200 status code"
            return $false
        }
        
        if ($errorMsg) {
            if ($attempt -lt $maxRetries) {
                # Exponential backoff: delay = min(initialDelay * 2^(attempt-1), maxDelay)
                $power = [System.Math]::Pow(2, $attempt - 1)
                $delay = [System.Math]::Min($initialDelay * $power, $maxDelay)
                $delay = [System.Math]::Round($delay)
                
                if ($isTimeout) {
                    $errorType = "timeout"
                } else {
                    $errorType = "error"
                }
                Write-Info "Attempt $attempt/$maxRetries failed ($errorType): $errorMsg"
                Write-Info "Retrying in $delay seconds (exponential backoff)..."
                Start-Sleep -Seconds $delay
                $attempt++
            } else {
                if ($isTimeout) {
                    $errorType = "timeout"
                } else {
                    $errorType = "error"
                }
                Write-Error "$ServiceName health check failed after $maxRetries attempts ($errorType): $errorMsg"
                Write-Info "Troubleshooting tips:"
                Write-Info "  - Verify server is running: Check process logs"
                Write-Info "  - Check if /health endpoint exists: curl $Url/health"
                $uriObj = [System.Uri]$Url
                $portNum = $uriObj.Port
                Write-Info "  - Verify port is accessible: Test-NetConnection -ComputerName localhost -Port $portNum"
                Write-Info "  - Server might need more time to start - increase MaxStartupWaitSeconds in config"
                return $false
            }
        } else {
            $attempt++
        }
    }
    
    return $false
}

# Cleanup function
function Stop-DevServers {
    param([array]$Processes)
    
    Write-Step "Stopping dev servers"
    
    foreach ($proc in $Processes) {
        if ($proc -and -not $proc.HasExited) {
            Write-Info "Stopping process (PID: $($proc.Id))"
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Write-Success "Stopped process (PID: $($proc.Id))"
            } catch {
                Write-Info "Process (PID: $($proc.Id)) already stopped or not found"
            }
        }
    }
}

# Main execution
$devProcesses = @()

try {
    Write-Host "`n" -NoNewline
    Write-Host "`n=====================================================================" -ForegroundColor Cyan
    Write-Host "     Development Orchestration Script                    " -ForegroundColor Cyan
    Write-Host "=====================================================================" -ForegroundColor Cyan
    
    # Step 1: Install dependencies
    Invoke-PnpmCommand "install" "Installing dependencies"
    
    # Step 2: Build all packages
    Invoke-PnpmCommand "build:all" "Building all packages"
    
    # Step 3: Start dev servers in background (with port readiness checks)
    Write-Step "Starting development servers"
    
    $serverProcess = Start-DevServer "dev:server" "Net Server" "NetServer"
    $devProcesses += $serverProcess
    
    $platformProcess = Start-DevServer "dev:platform" "Platform" "Platform"
    $devProcesses += $platformProcess
    
    $editorProcess = Start-DevServer "dev:editor" "Editor" "Editor"
    $devProcesses += $editorProcess
    
    # Step 4: Health checks (servers are already ready via port checks)
    Write-Host "`n" -NoNewline
    Write-Host "`n=====================================================================" -ForegroundColor Cyan
    Write-Host "     Health Checks                                        " -ForegroundColor Cyan
    Write-Host "=====================================================================" -ForegroundColor Cyan
    
    $dbOk = Test-DatabaseConnection -HostName $DbHost -Port $DbPort
    
    $netServerConfig = $ServiceConfig.NetServer
    $netServerOk = Test-ServerHealth -Url $netServerConfig.HealthCheckUrl -ServiceName "Net Server"
    
    $collabServerConfig = $ServiceConfig.CollabServer
    $collabServerOk = Test-ServerHealth -Url $collabServerConfig.HealthCheckUrl -ServiceName "Collab Server"
    
    # Step 5: Run tests
    Write-Host "`n" -NoNewline
    Write-Host "`n=====================================================================" -ForegroundColor Cyan
    Write-Host "     Running Tests                                        " -ForegroundColor Cyan
    Write-Host "=====================================================================" -ForegroundColor Cyan
    
    Invoke-PnpmCommand "test" "Running all tests"
    
    # Step 6: Commit (if not skipped)
    if (-not $SkipCommit) {
        Write-Host "`n" -NoNewline
        Write-Host "`n=====================================================================" -ForegroundColor Cyan
        Write-Host "     Committing Changes                                  " -ForegroundColor Cyan
        Write-Host "=====================================================================" -ForegroundColor Cyan
        
        Write-Step "Checking git status"
        
        $gitStatus = git status --porcelain
        if ($gitStatus) {
            Write-Info "Staging all changes"
            git add -A
            
            Write-Info "Committing with message: $CommitMessage"
            git commit -m $CommitMessage
            
            Write-Success "Changes committed successfully"
        } else {
            Write-Info "No changes to commit"
        }
    } else {
        Write-Info "Skipping commit (--SkipCommit flag set)"
    }
    
    # Summary
    Write-Host "`n" -NoNewline
    Write-Host "`n=====================================================================" -ForegroundColor Green
    Write-Host "     Summary                                               " -ForegroundColor Green
    Write-Host "=====================================================================" -ForegroundColor Green
    
    Write-Success "Installation: Complete"
    Write-Success "Build: Complete"
    $pids = $devProcesses.Id -join ", "
    Write-Success "Dev servers: Running (PIDs: $pids)"
    
    if ($dbOk) {
        Write-Success "Database: Connected"
    } else {
        Write-Error "Database: Connection failed"
    }
    
    if ($netServerOk) {
        Write-Success "Net Server: Healthy"
    } else {
        Write-Error "Net Server: Health check failed"
    }
    
    if ($collabServerOk) {
        Write-Success "Collab Server: Healthy"
    } else {
        Write-Error "Collab Server: Health check failed"
    }
    
    Write-Success "Tests: Complete"
    
    if (-not $SkipCommit) {
        Write-Success "Commit: Complete"
    }
    
    Write-Host "`n" -NoNewline
    Write-Host "`n=====================================================================" -ForegroundColor Yellow
    Write-Host "     Dev servers are running in background                 " -ForegroundColor Yellow
    Write-Host "     Press Ctrl+C to stop them                              " -ForegroundColor Yellow
    Write-Host "=====================================================================" -ForegroundColor Yellow
    
    # Keep script running so dev servers stay alive
    Write-Host "`nPress Ctrl+C to stop all dev servers and exit..." -ForegroundColor Yellow
    
    # Wait for Ctrl+C
    try {
        while ($true) {
            Start-Sleep -Seconds 1
            
            # Check if any process has exited unexpectedly
            foreach ($proc in $devProcesses) {
                if ($proc.HasExited) {
                    Write-Error "Dev server process (PID: $($proc.Id)) has exited unexpectedly"
                }
            }
        }
    } catch {
        # Ctrl+C caught
        Write-Host "`n" -NoNewline
        Write-Info "Interrupted by user"
    }
    
} catch {
    Write-Host "`n" -NoNewline
    Write-Error "Script failed: $($_.Exception.Message)"
    Write-Error "Stack trace: $($_.ScriptStackTrace)"
    exit 1
} finally {
    # Cleanup: Stop all dev servers
    Stop-DevServers -Processes $devProcesses
    Write-Host "`n" -NoNewline
    Write-Success "Cleanup complete"
}

