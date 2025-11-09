#!/bin/bash
# Docker Hub Push Script
# Usage: ./scripts/docker-push.sh <dockerhub-username> [tag]

set -e

DOCKERHUB_USERNAME="${1:-}"
TAG="${2:-latest}"

if [ -z "$DOCKERHUB_USERNAME" ]; then
    echo "❌ Error: Docker Hub username is required"
    echo "Usage: $0 <dockerhub-username> [tag]"
    exit 1
fi

echo "🐳 Building and pushing Docker images to Docker Hub..."
echo "Docker Hub Username: $DOCKERHUB_USERNAME"
echo "Tag: $TAG"
echo ""

# Images to build and push
declare -a IMAGES=(
    "collab-server:apps/collab-server/Dockerfile"
    "net-server:apps/net-server/Dockerfile"
)

# Login to Docker Hub
echo "🔐 Logging in to Docker Hub..."
docker login
if [ $? -ne 0 ]; then
    echo "❌ Docker login failed!"
    exit 1
fi

# Build and push each image
for IMAGE_INFO in "${IMAGES[@]}"; do
    IFS=':' read -r IMAGE_NAME DOCKERFILE <<< "$IMAGE_INFO"
    FULL_IMAGE_NAME="${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${TAG}"
    
    echo ""
    echo "📦 Building $IMAGE_NAME..."
    echo "   Image: $FULL_IMAGE_NAME"
    
    # Build the image
    docker build -f "$DOCKERFILE" -t "$FULL_IMAGE_NAME" .
    if [ $? -ne 0 ]; then
        echo "❌ Build failed for $IMAGE_NAME!"
        exit 1
    fi
    
    # Also tag as latest if different tag was provided
    if [ "$TAG" != "latest" ]; then
        LATEST_TAG="${DOCKERHUB_USERNAME}/${IMAGE_NAME}:latest"
        echo "🏷️  Tagging as latest: $LATEST_TAG"
        docker tag "$FULL_IMAGE_NAME" "$LATEST_TAG"
    fi
    
    # Push the image
    echo "⬆️  Pushing $FULL_IMAGE_NAME..."
    docker push "$FULL_IMAGE_NAME"
    if [ $? -ne 0 ]; then
        echo "❌ Push failed for $IMAGE_NAME!"
        exit 1
    fi
    
    # Push latest tag if different
    if [ "$TAG" != "latest" ]; then
        echo "⬆️  Pushing latest tag..."
        docker push "${DOCKERHUB_USERNAME}/${IMAGE_NAME}:latest"
    fi
    
    echo "✅ Successfully pushed $IMAGE_NAME"
done

echo ""
echo "🎉 All images successfully pushed to Docker Hub!"
echo ""
echo "Images pushed:"
for IMAGE_INFO in "${IMAGES[@]}"; do
    IFS=':' read -r IMAGE_NAME DOCKERFILE <<< "$IMAGE_INFO"
    echo "  - ${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${TAG}"
    if [ "$TAG" != "latest" ]; then
        echo "  - ${DOCKERHUB_USERNAME}/${IMAGE_NAME}:latest"
    fi
done

