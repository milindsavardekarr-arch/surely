import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'change-this-32-char-key-in-prod!!';

export const encryptSession = (data: object): string => {
  const jsonString = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
};

export const decryptSession = (encrypted: string): object | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
};
