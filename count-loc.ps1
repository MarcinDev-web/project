$totalLines = 0
$fileCount = 0

$directories = @('packages', 'apps', 'crates', 'scripts', 'shared')
$extensions = @('*.ts', '*.tsx', '*.js', '*.jsx', '*.wgsl', '*.rs')

foreach ($dir in $directories) {
    if (Test-Path $dir) {
        Write-Host "Scanning $dir..."
        $files = Get-ChildItem -Path $dir -Include $extensions -Recurse -ErrorAction SilentlyContinue | 
            Where-Object { 
                $_.FullName -notmatch 'node_modules|\\dist\\|\\target\\|\.d\.ts$|test-results|playwright-report|\.map$'
            }
        
        foreach ($file in $files) {
            try {
                $lines = (Get-Content $file.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
                $totalLines += $lines
                $fileCount++
            } catch {
                # Skip files that can't be read
            }
        }
    }
}

Write-Host "`nTotal files: $fileCount"
Write-Host "Total lines of code: $totalLines"










