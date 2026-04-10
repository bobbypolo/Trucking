import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const MAX_DIMENSION = 1920;
const COMPRESS_QUALITY = 0.7;

/**
 * Compresses an image by resizing to a maximum dimension (1920px)
 * and applying JPEG compression at 0.7 quality.
 *
 * @param uri - Local file URI of the image to compress
 * @returns Compressed image URI
 */
export async function compressImage(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: COMPRESS_QUALITY, format: SaveFormat.JPEG },
  );
  return result.uri;
}
