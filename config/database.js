const mysql = require('mysql2');
require('dotenv').config(); // Load file .env

// Jika ada link Aiven (DATABASE_URL), pakai itu. Jika tidak, pakai localhost.
const connection = process.env.DATABASE_URL
    ? mysql.createConnection(process.env.DATABASE_URL)
    : mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'dinedock'
    });

connection.connect((err) => {
    if (err) {
        console.error('❌ Gagal Konek Database: ' + err.stack);
        return;
    }
    console.log('✅ Berhasil Konek Database');
});

module.exports = connection;