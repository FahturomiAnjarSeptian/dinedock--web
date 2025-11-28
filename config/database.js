// config/database.js (FINAL STABLE: CONNECTION POOL)
const mysql = require('mysql2');
require('dotenv').config();

let pool;

// Konfigurasi dasar agar koneksi tidak gampang putus
const baseConfig = {
    waitForConnections: true,
    connectionLimit: 5, // Batasi max 5 koneksi (Aiven Free tier limitnya kecil)
    queueLimit: 0,
    connectTimeout: 60000 // 60 detik
};

if (process.env.DATABASE_URL) {
    // --- KONEKSI CLOUD (VERCEL + AIVEN) ---
    console.log("☁️ Menggunakan Connection Pool Cloud...");
    
    // Gabungkan config dasar dengan config URI Aiven
    const cloudConfig = Object.assign({}, baseConfig, {
        uri: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Wajib untuk Aiven
        }
    });
    
    pool = mysql.createPool(cloudConfig);

} else {
    // --- KONEKSI LOKAL (XAMPP) ---
    console.log("💻 Menggunakan Connection Pool Lokal...");
    
    pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'dinedock',
        ...baseConfig
    });
}

// Cek Koneksi (Hanya untuk log di awal)
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal membuat Pool Database:', err.message);
    } else {
        console.log('✅ Database Pool Siap!');
        connection.release(); // Kembalikan koneksi ke kolam
    }
});

// Export pool (cara pakainya sama persis dengan connection biasa)
module.exports = pool;