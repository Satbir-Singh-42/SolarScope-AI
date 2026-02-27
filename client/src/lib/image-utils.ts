// Image compression and optimization utilities for better performance

/**
 * Compresses an image file to reduce size and improve performance
 * @param file - The original image file
 * @param maxWidth - Maximum width for the compressed image (default: 1200)
 * @param quality - Compression quality 0-1 (default: 0.8)
 * @returns Promise<string> - Base64 data URL of compressed image
 */
export function compressImage(
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio (never upscale)
        const ratio = Math.min(1, maxWidth / img.width, maxWidth / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;

        // Set canvas dimensions
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw and compress image
        ctx?.drawImage(img, 0, 0, newWidth, newHeight);

        // Convert to base64 with compression
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}

/**
 * Cleans up old image data from sessionStorage to free space
 */
export function cleanupOldImages(): void {
  try {
    const keys = Object.keys(sessionStorage);
    const imageKeys = keys.filter(
      (key) =>
        key.includes("Image") || key.includes("Result") || key.includes("Url"),
    );

    // Remove oldest entries if we have more than 5 image-related items
    if (imageKeys.length > 5) {
      const keysToRemove = imageKeys.slice(0, imageKeys.length - 5);
      keysToRemove.forEach((key) => {
        sessionStorage.removeItem(key);
      });
      console.log(`Cleaned up ${keysToRemove.length} old image entries`);
    }
  } catch (error) {
    console.error("Error cleaning up images:", error);
  }
}
