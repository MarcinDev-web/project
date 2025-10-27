# Test Helper Scripts for PowerShell

function Show-TestMenu {
    Write-Host "🧪 Test Automation Menu" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Development:" -ForegroundColor Yellow
    Write-Host "  1. test:watch       - Watch mode (live feedback)"
    Write-Host "  2. test:changed     - Run changed tests"
    Write-Host "  3. test:unit:fast   - Quick run (no coverage)"
    Write-Host "  4. test:ui          - Visual test runner"
    Write-Host ""
    Write-Host "Coverage:" -ForegroundColor Yellow
    Write-Host "  5. test:coverage    - Full coverage report"
    Write-Host "  6. coverage:view    - Open coverage in browser"
    Write-Host ""
    Write-Host "Debugging:" -ForegroundColor Yellow
    Write-Host "  7. test:verbose     - Verbose output"
    Write-Host "  8. test:failed      - Re-run failed tests"
    Write-Host ""
    Write-Host "Other:" -ForegroundColor Yellow
    Write-Host "  9. clean:cache      - Clear test cache"
    Write-Host "  0. Exit"
    Write-Host ""
}

function Run-TestCommand {
    param([string]$Command)
    
    switch ($Command) {
        "1" { pnpm test:watch }
        "2" { pnpm test:changed }
        "3" { pnpm test:unit:fast }
        "4" { pnpm test:ui }
        "5" { pnpm test:coverage }
        "6" { 
            if (Test-Path "coverage/index.html") {
                Start-Process "coverage/index.html"
            } else {
                Write-Host "❌ Coverage report not found. Run 'pnpm test:coverage' first." -ForegroundColor Red
            }
        }
        "7" { pnpm test:unit -- --reporter=verbose }
        "8" { pnpm test:unit -- --only-failed }
        "9" { 
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "node_modules/.vitest"
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "coverage"
            Write-Host "✅ Cache cleared!" -ForegroundColor Green
        }
        "0" { exit }
        default { Write-Host "❌ Invalid option" -ForegroundColor Red }
    }
}

# Main loop
while ($true) {
    Clear-Host
    Show-TestMenu
    $choice = Read-Host "Select option"
    
    if ($choice -eq "0") { break }
    
    Run-TestCommand $choice
    
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

