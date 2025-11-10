/**
 * Utility functions for capturing thumbnails from canvas
 * Can be used for marketplace item thumbnails
 */

/**
 * Capture thumbnail from canvas element
 * @param canvas - Canvas element to capture from
 * @param maxWidth - Maximum width of thumbnail (default: 800px for 2x retina)
 * @param maxHeight - Maximum height of thumbnail (default: 450px for 16:9 aspect)
 * @param quality - JPEG quality 0-1 (default: 0.85)
 * @returns Promise<Blob> - Thumbnail as JPEG blob
 */
export async function captureThumbnailFromCanvas(
  canvas: HTMLCanvasElement,
  maxWidth: number = 800,
  maxHeight: number = 450,
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Calculate scaled dimensions maintaining aspect ratio
    let width = canvas.width;
    let height = canvas.height;
    const aspectRatio = width / height;

    if (width > maxWidth) {
      width = maxWidth;
      height = Math.round(width / aspectRatio);
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = Math.round(height * aspectRatio);
    }

    // Create temporary canvas for resizing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get 2D context'));
      return;
    }

    // Draw scaled image
    ctx.drawImage(canvas, 0, 0, width, height);

    // Convert to blob
    tempCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Upload thumbnail to marketplace item
 * @param marketplaceItemId - ID of marketplace item
 * @param thumbnailBlob - Thumbnail image as blob
 * @param authToken - Authentication token
 * @returns Promise with upload result
 */
export async function uploadThumbnail(
  marketplaceItemId: string,
  thumbnailBlob: Blob,
  authToken?: string
): Promise<{ success: boolean; thumbnailUrl: string; message: string }> {
  const formData = new FormData();
  formData.append('image', thumbnailBlob, 'thumbnail.jpg');

  const headers: HeadersInit = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`/api/marketplace/${marketplaceItemId}/thumbnail`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload thumbnail');
  }

  return response.json();
}

/**
 * Capture and upload thumbnail from canvas in one operation
 * @param canvas - Canvas element to capture from
 * @param marketplaceItemId - ID of marketplace item
 * @param authToken - Authentication token
 * @returns Promise with upload result
 */
export async function captureAndUploadThumbnail(
  canvas: HTMLCanvasElement,
  marketplaceItemId: string,
  authToken?: string
): Promise<{ success: boolean; thumbnailUrl: string; message: string }> {
  // Capture thumbnail
  const thumbnailBlob = await captureThumbnailFromCanvas(canvas);

  // Upload thumbnail
  return uploadThumbnail(marketplaceItemId, thumbnailBlob, authToken);
}

/**
 * Example usage in publish workflow:
 * 
 * ```typescript
 * // After project is published to marketplace
 * const marketplaceItemId = publishResult.marketplaceItem.id;
 * 
 * // Get canvas from WebGPU renderer
 * const canvas = document.querySelector('canvas');
 * 
 * if (canvas) {
 *   try {
 *     const result = await captureAndUploadThumbnail(
 *       canvas,
 *       marketplaceItemId,
 *       authToken
 *     );
 *     console.log('Thumbnail uploaded:', result.thumbnailUrl);
 *   } catch (error) {
 *     console.error('Failed to upload thumbnail:', error);
 *   }
 * }
 * ```
 */

