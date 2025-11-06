# Install wasm-pack if not already installed (PowerShell version)
# Used by CI/CD build environments that don't have wasm-pack pre-installed

if (Get-Command wasm-pack -ErrorAction SilentlyContinue) {
    $version = wasm-pack --version
    Write-Host "wasm-pack is already installed: $version"
    exit 0
}

Write-Host "Installing wasm-pack..."

# Detect architecture
$arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
$version = "v0.12.1"
$target = "x86_64-pc-windows-msvc"

if ($arch -eq "Arm64") {
    $target = "aarch64-pc-windows-msvc"
}

$url = "https://github.com/rustwasm/wasm-pack/releases/download/$version/wasm-pack-$version-$target.tar.gz"

Write-Host "Downloading from: $url"

try {
    # Download
    Invoke-WebRequest -Uri $url -OutFile "wasm-pack.tar.gz" -ErrorAction Stop
    
    # Extract (requires tar.exe which is available in Windows 10+)
    tar -xzf wasm-pack.tar.gz
    
    # Create install directory
    $installDir = "$env:USERPROFILE\.local\bin"
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    
    # Move executable
    Move-Item -Path "wasm-pack-$version-$target\wasm-pack.exe" -Destination "$installDir\wasm-pack.exe" -Force
    
    # Add to PATH for this session
    $env:PATH = "$env:PATH;$installDir"
    
    # Save PATH for future sessions
    $pathFile = ".wasm-pack-env.ps1"
    "`$env:PATH = `"`$env:PATH;$installDir`"" | Out-File -FilePath $pathFile -Encoding UTF8
    
    Write-Host "Installed wasm-pack to $installDir"
    
    # Cleanup
    Remove-Item -Recurse -Force "wasm-pack-$version-$target"
    Remove-Item -Force "wasm-pack.tar.gz"
    
    # Verify installation
    if (Test-Path "$installDir\wasm-pack.exe") {
        $installedVersion = & "$installDir\wasm-pack.exe" --version
        Write-Host "wasm-pack installed successfully: $installedVersion"
    } else {
        Write-Warning "wasm-pack installed but verification failed"
    }
} catch {
    Write-Error "Failed to install wasm-pack: $_"
    exit 1
}

