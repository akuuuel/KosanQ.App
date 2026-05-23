/**
 * Security-focused Input Validation Utility
 */

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

export const validatePassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 8) {
    return { isValid: false, message: 'Password minimal 8 karakter' };
  }
  // Optional: add more checks for production (uppercase, numbers, etc.)
  return { isValid: true, message: '' };
};

export const validateRequiredFields = (fields: Record<string, any>): string | null => {
  for (const [key, value] of Object.entries(fields)) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${key} tidak boleh kosong`;
    }
  }
  return null;
};

/**
 * Mencegah XSS sederhana dengan membersihkan input teks
 */
export const sanitizeText = (text: string): string => {
  return text.trim().replace(/[<>]/g, ''); 
};

/**
 * Validasi angka positif (untuk harga/kamar)
 */
export const validatePositiveNumber = (num: number): boolean => {
  return !isNaN(num) && num >= 0;
};
