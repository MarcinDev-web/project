# Setup test environment
# Run this after cloning the repository

Write-Host "🔧 Setting up test environment..." -ForegroundColor Cyan

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
pnpm install

# Setup Husky hooks
Write-Host "🪝 Setting up git hooks..." -ForegroundColor Yellow
pnpm prepare

# Build test-utils package
Write-Host "🛠️  Building test utilities..." -ForegroundColor Yellow
pnpm --filter @engine/test-utils build

# Run initial test to verify setup
Write-Host "🧪 Running initial test..." -ForegroundColor Yellow
pnpm test:unit:fast

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Quick Start:" -ForegroundColor Cyan
Write-Host "  - Run 'pnpm test:watch' to start watch mode"
Write-Host "  - Run 'pnpm test:changed' before committing"
Write-Host "  - See 'docs/TESTING_AUTOMATION.md' for full guide"
Write-Host ""

