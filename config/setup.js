// config/setup.js
const db = require('./database');
const bcrypt = require('bcryptjs');

const initDatabase = () => {
    console.log("🔄 Memulai Inisialisasi Database Otomatis...");

    // 1. TABEL USERS
    const createUsers = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            role ENUM('customer', 'admin') DEFAULT 'customer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

    // 2. TABEL TABLES (MEJA)
    const createTables = `
        CREATE TABLE IF NOT EXISTS tables (
            id VARCHAR(5) PRIMARY KEY,
            capacity INT DEFAULT 4,
            location VARCHAR(50) DEFAULT 'Indoor',
            status ENUM('available', 'maintenance') DEFAULT 'available'
        )`;

    // 3. TABEL PARKING
    const createParking = `
        CREATE TABLE IF NOT EXISTS parking_slots (
            id VARCHAR(5) PRIMARY KEY,
            type ENUM('car', 'bike') NOT NULL,
            status ENUM('available', 'maintenance') DEFAULT 'available'
        )`;

    // 4. TABEL RESERVATIONS
    const createReservations = `
        CREATE TABLE IF NOT EXISTS reservations (
            id VARCHAR(20) PRIMARY KEY,
            user_id INT NOT NULL,
            table_id VARCHAR(5) NOT NULL,
            parking_slot_id VARCHAR(5) NULL,
            reservation_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            status ENUM('pending', 'confirmed', 'checked_in', 'cancelled') DEFAULT 'pending',
            payment_status ENUM('unpaid', 'paid') DEFAULT 'unpaid',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (table_id) REFERENCES tables(id),
            FOREIGN KEY (parking_slot_id) REFERENCES parking_slots(id)
        )`;

    // 5. TABEL MENUS
    const createMenus = `
        CREATE TABLE IF NOT EXISTS menus (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            price DECIMAL(10,2),
            category ENUM('food', 'beverage', 'dessert') NOT NULL,
            image_url VARCHAR(255)
        )`;

    // --- EKSEKUSI PEMBUATAN TABEL ---
    db.query(createUsers, () => { console.log(" - Tabel Users OK"); });
    db.query(createTables, () => { console.log(" - Tabel Tables OK"); });
    db.query(createParking, () => { console.log(" - Tabel Parking OK"); });
    db.query(createReservations, () => { console.log(" - Tabel Reservations OK"); });
    db.query(createMenus, () => { console.log(" - Tabel Menus OK"); });

    // --- SEEDING DATA (ISI DATA AWAL) ---
    // Kita pakai setTimeout agar tabel jadi dulu baru diisi

    setTimeout(() => {
        console.log("🌱 Mengisi Data Awal...");

        // A. DATA MEJA (T01 - T10) - Pakai INSERT IGNORE agar tidak error kalau sudah ada
        const seedTables = `INSERT IGNORE INTO tables (id, capacity) VALUES 
            ('T01', 4), ('T02', 4), ('T03', 4), ('T04', 4), ('T05', 4),
            ('T06', 4), ('T07', 4), ('T08', 4), ('T09', 4), ('T10', 4)`;
        db.query(seedTables);

        // B. DATA PARKIR (A1-A10 Mobil, B1-B10 Motor)
        const seedParking = `INSERT IGNORE INTO parking_slots (id, type) VALUES 
            ('A1', 'car'), ('A2', 'car'), ('A3', 'car'), ('A4', 'car'), ('A5', 'car'),
            ('A6', 'car'), ('A7', 'car'), ('A8', 'car'), ('A9', 'car'), ('A10', 'car'),
            ('B1', 'bike'), ('B2', 'bike'), ('B3', 'bike'), ('B4', 'bike'), ('B5', 'bike'),
            ('B6', 'bike'), ('B7', 'bike'), ('B8', 'bike'), ('B9', 'bike'), ('B10', 'bike')`;
        db.query(seedParking);

        // C. DATA MENU MAKANAN
        const seedMenus = `INSERT IGNORE INTO menus (id, name, description, price, category, image_url) VALUES 
            (1, 'Salmon Sashimi Supreme', 'Irisan ikan salmon segar Norwegia.', 85000, 'food', 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351'),
            (2, 'Wagyu Beef Steak', 'Daging sapi Wagyu A5.', 250000, 'food', 'https://images.unsplash.com/photo-1546241072-48010ad2862c'),
            (3, 'Dragon Roll Sushi', 'Sushi roll isi udang tempura.', 55000, 'food', 'https://images.unsplash.com/photo-1553621042-f6e147245754'),
            (4, 'Matcha Latte', 'Teh hijau asli Jepang.', 35000, 'beverage', 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7'),
            (5, 'Ogura Ice Cream', 'Es krim kacang merah.', 25000, 'dessert', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb')`;
        db.query(seedMenus);

        // D. CREATE ADMIN ACCOUNT (PENTING! Karena di cloud ga bisa edit manual)
        // Email: admin@dinedock.com, Pass: admin123
        const adminPass = bcrypt.hashSync('admin123', 10);
        const seedAdmin = `INSERT IGNORE INTO users (id, name, email, phone, password, role) VALUES 
            (1, 'Super Admin', 'admin@dinedock.com', '08123456789', '${adminPass}', 'admin')`;
        db.query(seedAdmin, () => {
            console.log("✅ Data Awal Selesai Diisi! Admin: admin@dinedock.com / admin123");
        });

    }, 3000); // Jeda 3 detik
};

module.exports = initDatabase;