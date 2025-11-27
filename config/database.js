// config/database.js (VERCEL & AIVEN FIX)
const mysql = require('mysql2');
require('dotenv').config();

let connection;

if (process.env.DATABASE_URL) {
    // --- KONEKSI CLOUD (VERCEL + AIVEN) ---
    console.log("☁️ Mencoba konek ke Aiven...");
    
    connection = mysql.createConnection({
        uri: process.env.DATABASE_URL, // Pakai link dari env
        ssl: {
            rejectUnauthorized: false // PENTING: Agar Aiven mau menerima koneksi SSL
        },
        connectTimeout: 20000 // Tambah waktu tunggu jadi 20 detik biar gak gampang timeout
    });

} else {
    // --- KONEKSI LOKAL (XAMPP) ---
    console.log("💻 Mencoba konek ke Localhost...");
    
    connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'dinedock'
    });
}

connection.connect((err) => {
    if (err) {
        console.error('❌ Gagal Konek Database: ' + err.message);
        return;
    }
    console.log('✅ Berhasil Konek Database!');
});

module.exports = connection;