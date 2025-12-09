import PocketBase from 'pocketbase';

// 1. Ambil URL dari Environment Variable (Coolify). 
// 2. Jika kosong (misal saat coding di laptop), otomatis pakai localhost.
const url = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(url);

// Opsi tambahan kamu tetap aman di sini
pb.autoCancellation(false);