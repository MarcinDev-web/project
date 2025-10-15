# Skrypt do instalacji Git hooks na Windows

$gitDir = ".git"
$hooksDir = Join-Path $gitDir "hooks"

if (-not (Test-Path $gitDir)) {
    Write-Host "Błąd: Nie znaleziono folderu .git - to nie jest repozytorium Git" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $hooksDir)) {
    Write-Host "Tworzenie folderu hooks..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $hooksDir | Out-Null
}

# Pre-commit hook
$preCommitContent = @"
#!/bin/sh
# Pre-commit hook - uruchamia testy przed każdym commitem

echo "🔍 Uruchamiam linter..."
npm run lint
if [ `$? -ne 0 ]; then
    echo "❌ Linter znalazł błędy. Napraw je przed commitem."
    exit 1
fi

echo "🧪 Uruchamiam szybkie testy..."
npm run test:fast
if [ `$? -ne 0 ]; then
    echo "❌ Testy nie przeszły. Napraw je przed commitem."
    exit 1
fi

echo "✅ Wszystko OK - commit może być zatwierdzony!"
exit 0
"@

$preCommitPath = Join-Path $hooksDir "pre-commit"
Set-Content -Path $preCommitPath -Value $preCommitContent -Encoding UTF8

# Pre-push hook
$prePushContent = @"
#!/bin/sh
# Pre-push hook - uruchamia pełne testy przed pushem

echo "🧪 Uruchamiam pełne testy przed pushem..."
npm run test
if [ `$? -ne 0 ]; then
    echo "❌ Testy nie przeszły. Napraw je przed pushem."
    exit 1
fi

echo "✅ Wszystko OK - push może być wykonany!"
exit 0
"@

$prePushPath = Join-Path $hooksDir "pre-push"
Set-Content -Path $prePushPath -Value $prePushContent -Encoding UTF8

Write-Host "✅ Git hooks zostały zainstalowane pomyślnie!" -ForegroundColor Green
Write-Host ""
Write-Host "Zainstalowane hooki:" -ForegroundColor Cyan
Write-Host "  - pre-commit: uruchamia linter i szybkie testy" -ForegroundColor White
Write-Host "  - pre-push: uruchamia pełne testy" -ForegroundColor White
Write-Host ""
Write-Host "Aby wyłączyć hooki przy commitcie, użyj: git commit --no-verify" -ForegroundColor Yellow

