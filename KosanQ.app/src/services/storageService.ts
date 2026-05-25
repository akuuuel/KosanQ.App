import * as ImageManipulator from 'expo-image-manipulator';

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/**
 * Validasi gambar sebelum diupload (Size & Type)
 */
export const validateImage = (size: number, mimeType: string) => {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

  if (!ALLOWED_TYPES.includes(mimeType.toLowerCase())) {
    throw new Error('Hanya format JPG dan PNG yang diizinkan');
  }
  if (size > MAX_SIZE) {
    throw new Error('Ukuran gambar tidak boleh lebih dari 5MB');
  }
};

/**
 * Kompres dan resize gambar sebelum upload untuk menghemat bandwidth.
 */
export const compressAndResizeImage = async (uri: string): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }], // Lebar 1200px adalah standar profesional
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG } // 0.6 jauh lebih ringan untuk data internet
    );
    return result.uri;
  } catch (error) {
    console.error('Error manipulating image:', error);
    // Kembalikan URI asli sebagai fallback agar proses tidak terhenti total
    return uri;
  }
};

/**
 * Upload gambar ke Cloudinary menggunakan REST API (Unsigned Upload).
 * Jika upload gagal, kembalikan URI lokal sebagai fallback agar
 * alur penyimpanan kost tidak berhenti.
 */
export const uploadImage = async (uri: string, path: string): Promise<string> => {
  // Pastikan variabel environment tersedia
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    console.error('Cloudinary configuration is missing! Check your .env file or build settings.');
    throw new Error('Konfigurasi server gambar belum diatur.');
  }

  // Jika URI sudah berupa URL remote (sudah diupload sebelumnya), skip upload
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  try {
    const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: `upload_${Date.now()}.jpg`,
    } as any);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', path);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Cloudinary Upload Error Details:', errorData);
      throw new Error(errorData.error?.message || `Upload gagal dengan status ${response.status}`);
    }

    const data = await response.json();

    if (data.secure_url) {
      return data.secure_url;
    } else {
      throw new Error('Server tidak mengembalikan link gambar.');
    }
  } catch (error: any) {
    console.error('Error uploading to Cloudinary:', error);
    // Sekarang kita melempar error agar proses di UI berhenti dan user tahu ada masalah
    throw new Error(error.message || 'Gagal mengunggah gambar. Periksa koneksi internet Anda.');
  }
};
