# Docker Hub Push Script
# Usage: .\scripts\docker-push.ps1 -DockerHubUsername "yourusername" [-Tag "latest"]

param(
    [Parameter(Mandatory=$true)]
    [string]$DockerHubUsername,
    
    [Parameter(Mandatory=$false)]
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

Write-Host "Building and pushing Docker images to Docker Hub..." -ForegroundColor Cyan
Write-Host "Docker Hub Username: $DockerHubUsername" -ForegroundColor Yellow
Write-Host "Tag: $Tag" -ForegroundColor Yellow
Write-Host ""

# Images to build and push
$images = @(
    @{
        Name = "collab-server"
        Dockerfile = "apps/collab-server/Dockerfile"
        Context = "."
    },
    @{
        Name = "net-server"
        Dockerfile = "apps/net-server/Dockerfile"
        Context = "."
    }
)

# Login to Docker Hub
Write-Host "Logging in to Docker Hub..." -ForegroundColor Cyan
docker login
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker login failed!" -ForegroundColor Red
    exit 1
}

# Build and push each image
foreach ($image in $images) {
    $imageName = $image.Name
    $dockerfile = $image.Dockerfile
    $context = $image.Context
    $fullImageName = "${DockerHubUsername}/${imageName}:${Tag}"
    
    Write-Host ""
    Write-Host "Building $imageName..." -ForegroundColor Cyan
    Write-Host "   Image: $fullImageName" -ForegroundColor Gray
    
    # Build the image
    docker build -f $dockerfile -t $fullImageName $context
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed for $imageName!" -ForegroundColor Red
        exit 1
    }
    
    # Also tag as latest if different tag was provided
    if ($Tag -ne "latest") {
        $latestTag = "${DockerHubUsername}/${imageName}:latest"
        Write-Host "Tagging as latest: $latestTag" -ForegroundColor Gray
        docker tag $fullImageName $latestTag
    }
    
    # Push the image
    Write-Host "Pushing $fullImageName..." -ForegroundColor Cyan
    docker push $fullImageName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Push failed for $imageName!" -ForegroundColor Red
        exit 1
    }
    
    # Push latest tag if different
    if ($Tag -ne "latest") {
        Write-Host "Pushing latest tag..." -ForegroundColor Cyan
        docker push "${DockerHubUsername}/${imageName}:latest"
    }
    
    Write-Host "Successfully pushed $imageName" -ForegroundColor Green
}

Write-Host ""
Write-Host "All images successfully pushed to Docker Hub!" -ForegroundColor Green
Write-Host ""
Write-Host "Images pushed:" -ForegroundColor Cyan
foreach ($image in $images) {
    Write-Host "  - ${DockerHubUsername}/$($image.Name):${Tag}" -ForegroundColor Gray
    if ($Tag -ne "latest") {
        Write-Host "  - ${DockerHubUsername}/$($image.Name):latest" -ForegroundColor Gray
    }
}
