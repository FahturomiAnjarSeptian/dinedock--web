// config/database.js (VERCEL + AIVEN SSL FIX)
const mysql = require('mysql2');
require('dotenv').config();

let connection;

// Konfigurasi Koneksi
const config = {
    connectTimeout: 60000, // 60 detik biar gak timeout
};

if (process.env.DATABASE_URL) {
    // --- KONEKSI CLOUD (AIVEN) ---
    console.log("☁️ Menggunakan Koneksi Cloud...");
    Object.assign(config, {
        uri: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // PENTING: Agar mau konek ke Aiven
        }
    });
    connection = mysql.createConnection(config);
} else {
    // --- KONEKSI LOKAL ---
    console.log("💻 Menggunakan Koneksi Lokal...");
    connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'dinedock'
    });
}

// Coba Konek
connection.connect((err) => {
    if (err) {
        console.error('❌ Gagal Konek Database:', err.message);
        return;
    }
    console.log('✅ Berhasil Konek Database!');
});

// Penanganan Error Putus Nyambung (Auto Reconnect sederhana)
connection.on('error', function(err) {
    console.log('⚠️ db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { 
        console.log('Mencoba konek ulang...');
    } else {                                      
        throw err;                                  
    }
});

module.exports = connection;