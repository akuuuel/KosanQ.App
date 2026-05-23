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
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET || '');
    formData.append('folder', path);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      // Jangan set Content-Type manual untuk multipart/form-data —
      // browser/fetch otomatis mengisi boundary yang benar
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Upload gagal dengan status ${response.status}`);
    }

    const data = await response.json();

    if (data.secure_url) {

      return data.secure_url;
    } else {
      throw new Error(data.error?.message || 'Cloudinary tidak mengembalikan URL');
    }
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    // Kembalikan URI lokal sebagai fallback agar data kost tetap bisa disimpan
    console.warn('Menggunakan URI lokal sebagai fallback:', uri);
    return uri;
  }
};
