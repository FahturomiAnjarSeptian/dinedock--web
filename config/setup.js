// config/setup.js (Versi Support Vercel / Async)
const db = require('./database');
const bcrypt = require('bcryptjs');

// Kita bungkus jadi Async Function agar bisa ditunggu (await)
const initDatabase = async () => {
    console.log("🔄 Memulai Inisialisasi Database...");

    // Helper kecil untuk mengubah db.query (callback) menjadi Promise (async/await)
    const query = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    try {
        // 1. BUAT TABEL (Pakai await supaya berurutan)
        await query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100) UNIQUE, password VARCHAR(255), phone VARCHAR(20), role ENUM('customer', 'admin') DEFAULT 'customer', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await query(`CREATE TABLE IF NOT EXISTS tables (id VARCHAR(5) PRIMARY KEY, capacity INT DEFAULT 4, location VARCHAR(50) DEFAULT 'Indoor', status ENUM('available', 'maintenance') DEFAULT 'available')`);
        await query(`CREATE TABLE IF NOT EXISTS parking_slots (id VARCHAR(5) PRIMARY KEY, type ENUM('car', 'bike'), status ENUM('available', 'maintenance') DEFAULT 'available')`);
        await query(`CREATE TABLE IF NOT EXISTS reservations (id VARCHAR(20) PRIMARY KEY, user_id INT, table_id VARCHAR(5), parking_slot_id VARCHAR(5), reservation_date DATE, start_time TIME, end_time TIME, status ENUM('pending', 'confirmed', 'checked_in', 'cancelled') DEFAULT 'pending', payment_status ENUM('unpaid', 'paid') DEFAULT 'unpaid', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (table_id) REFERENCES tables(id), FOREIGN KEY (parking_slot_id) REFERENCES parking_slots(id))`);
        await query(`CREATE TABLE IF NOT EXISTS menus (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), description TEXT, price DECIMAL(10,2), category ENUM('food', 'beverage', 'dessert'), image_url VARCHAR(255))`);

        // 2. ISI DATA
        console.log("🌱 Sedang Mengisi Data...");
        
        await query("DELETE FROM menus"); // Hapus menu lama
        
        // Menu
        await query(`INSERT INTO menus (id, name, description, price, category, image_url) VALUES 
        (1, 'Salmon Sashimi Supreme', 'Irisan ikan salmon segar Norwegia.', 85000, 'food', 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351'),
        (2, 'Wagyu Beef Steak', 'Daging sapi Wagyu A5.', 250000, 'food', 'https://images.unsplash.com/photo-1546241072-48010ad2862c'),
        (3, 'Chicken Katsu', 'Daging Ayam asli jepang', 25000, 'food', '/img/katsu.jpg'),
        (4, 'Beef Teriyaki', 'Daging sapi segar asli jepang', 25000, 'food', '/img/teriyaki.jpg'),
        (5, 'Dragon Roll Sushi', 'Sushi roll isi udang tempura.', 55000, 'food', 'https://images.unsplash.com/photo-1553621042-f6e147245754'),
        (6, 'Matcha Latte', 'Teh hijau asli Jepang.', 35000, 'beverage', 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7'),
        (7, 'Capuccino Latte', 'Capucino asli dari Italia.', 35000, 'beverage', '/img/latte.jpg'),
        (8, 'Jus Alpukat', 'Alpukat segar pilihan.', 10000, 'beverage', '/img/alpukat.jpg'),
        (9, 'Ogura Ice Cream', 'Es krim kacang merah.', 25000, 'dessert', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb')`);

        // Tables
        await query(`INSERT IGNORE INTO tables (id, capacity) VALUES ('T01', 4), ('T02', 4), ('T03', 4), ('T04', 4), ('T05', 4), ('T06', 4), ('T07', 4), ('T08', 4), ('T09', 4), ('T10', 4)`);

        // Parking
        await query(`INSERT IGNORE INTO parking_slots (id, type) VALUES 
        ('A1', 'car'), ('A2', 'car'), ('A3', 'car'), ('A4', 'car'), ('A5', 'car'), ('A6', 'car'), ('A7', 'car'), ('A8', 'car'), ('A9', 'car'), ('A10', 'car'),
        ('B1', 'bike'), ('B2', 'bike'), ('B3', 'bike'), ('B4', 'bike'), ('B5', 'bike'), ('B6', 'bike'), ('B7', 'bike'), ('B8', 'bike'), ('B9', 'bike'), ('B10', 'bike')`);

        // Admin
        const adminPass = bcrypt.hashSync('admin123', 10);
        await query(`INSERT IGNORE INTO users (id, name, email, phone, password, role) VALUES (1, 'Super Admin', 'admin@dinedock.com', '08123456789', ?, 'admin')`, [adminPass]);

        console.log("✅ SELESAI! Semua data masuk.");
        return true; // Beri sinyal sukses

    } catch (error) {
        console.error("❌ Error Setup:", error);
        throw error; // Lempar error ke app.js
    }
};

module.exports = initDatabase;