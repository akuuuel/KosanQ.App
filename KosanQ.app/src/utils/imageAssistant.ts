import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Mengompresi gambar untuk menghemat bandwidth dan storage
 * Mengurangi resolusi ke max 1200px dan kualitas ke 70%
 */
export const compressImage = async (uri: string) => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }], // Maksimal lebar 1200px (sudah sangat cukup untuk layar HP)
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // Kualitas 70% JPEG (keseimbangan terbaik ukuran vs kualitas)
    );
    return result.uri;
  } catch (error) {
    console.error('[ImageAssistant] Compression failed:', error);
    return uri; // Return original if failed
  }
};
