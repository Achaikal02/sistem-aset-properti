// src/lib/pocketbase.js
import PocketBase from 'pocketbase';

export const pb = new PocketBase('http://127.0.0.1:8090');

// TAMBAHKAN BARIS INI:
pb.autoCancellation(false);