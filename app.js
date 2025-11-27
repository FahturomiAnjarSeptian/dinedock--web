// app.js (VERCEL READY - VS CODE VERSION)
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs'); 
const db = require('./config/database'); 
const qrcode = require('qrcode'); 
const nodemailer = require('nodemailer');
// Library baru untuk simpan session di MySQL
const MySQLStore = require('express-mysql-session')(session);

const app = express();
const PORT = 3000;

const APP_DOMAIN = process.env.APP_DOMAIN || "localhost:3000";

app.set('view engine', 'ejs');

// GANTI BARIS INI:
// app.set('views', './views'); 

// MENJADI INI (Agar Vercel bisa menemukannya):
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(bodyParser.json()); 

// --- SESSION STORE (PENTING UNTUK VERCEL) ---
const sessionStore = new MySQLStore({}, db); // Pakai koneksi db yang sudah ada

app.use(session({
    key: 'session_cookie_name',
    secret: process.env.SESSION_SECRET || 'rahasia_default',
    store: sessionStore, // Simpan session di MySQL Aiven
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, 
        maxAge: 3600000 // 1 Jam
    }
}));

// --- MIDDLEWARES ---
const requireLogin = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.send("<h1>403 Forbidden</h1><p>Anda bukan Admin!</p><a href='/'>Kembali</a>");
    }
    next();
};

// --- KONFIGURASI EMAIL ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'anjargaming06@gmail.com', 
        pass: process.env.GMAIL_PASS || 'jtjyoqtnskprfmrj' 
    }
});

// --- ROUTES ---

app.get('/', (req, res) => {
    res.render('landing', { user: req.session.userId ? req.session : null });
});

app.get('/menu', (req, res) => {
    db.query("SELECT * FROM menus", (err, results) => {
        if (err) throw err;
        res.render('menu', { menus: results, user: req.session.userId ? req.session : null });
    });
});

app.get('/dashboard', requireLogin, (req, res) => {
    const sqlTables = "SELECT * FROM tables ORDER BY id ASC";
    const sqlParking = "SELECT * FROM parking_slots ORDER BY id ASC";

    db.query(sqlTables, (err, tablesResult) => {
        if (err) throw err;
        db.query(sqlParking, (err, parkingResult) => {
            if (err) throw err;
            const mobil = parkingResult.filter(slot => slot.type === 'car');
            const motor = parkingResult.filter(slot => slot.type === 'bike');
            res.render('dashboard', { 
                tables: tablesResult, mobil: mobil, motor: motor, user: req.session 
            });
        });
    });
});

// --- AUTH ROUTES ---

app.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('login');
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) throw err;
        if (results.length === 0 || !bcrypt.compareSync(password, results[0].password)) {
            return res.render('login', { error: 'Email atau Password Salah!' });
        }
        req.session.userId = results[0].id;
        req.session.userName = results[0].name;
        req.session.role = results[0].role;
        res.redirect('/dashboard');
    });
});

app.post('/register', (req, res) => {
    const { name, email, phone, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const sql = "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'customer')";
    db.query(sql, [name, email, phone, hashedPassword], (err, result) => {
        if (err) return res.render('login', { error: 'Email sudah terdaftar!' });
        res.render('login', { error: 'Registrasi Berhasil! Silakan Login.' });
    });
});

app.post('/auth/google', (req, res) => {
    const { email, name, phone } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.sendStatus(500);
        if (results.length > 0) {
            req.session.userId = results[0].id;
            req.session.userName = results[0].name;
            req.session.role = results[0].role;
            return res.sendStatus(200);
        } else {
            const dummyPassword = bcrypt.hashSync("GOOGLE_ACCESS_TOKEN", 10);
            const sqlInsert = "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'customer')";
            db.query(sqlInsert, [name, email, phone, dummyPassword], (err, result) => {
                if (err) return res.sendStatus(500);
                req.session.userId = result.insertId;
                req.session.userName = name;
                req.session.role = 'customer';
                return res.sendStatus(200);
            });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- BOOKING PROCESS ---

app.post('/book', requireLogin, (req, res) => {
    const { name, email, phone, date, time, table_id, parking_id } = req.body;
    const userId = req.session.userId;
    let [hours, minutes] = time.split(':');
    let endDate = new Date();
    endDate.setHours(parseInt(hours) + 1);
    endDate.setMinutes(parseInt(minutes) + 30);
    const endTime = endDate.toTimeString().split(' ')[0]; 
    const startTime = time + ":00";
    const finalParkingId = parking_id === '' ? null : parking_id;
    const bookingId = "RES-" + Date.now();

    const sqlBooking = `INSERT INTO reservations 
        (id, user_id, table_id, parking_slot_id, reservation_date, start_time, end_time, status, payment_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')`;

    db.query(sqlBooking, [bookingId, userId, table_id, finalParkingId, date, startTime, endTime], (err, result) => {
        if (err) return res.send("Gagal Reservasi.");
        db.query("UPDATE tables SET status = 'maintenance' WHERE id = ?", [table_id]);
        if (finalParkingId) db.query("UPDATE parking_slots SET status = 'maintenance' WHERE id = ?", [finalParkingId]);
        res.redirect('/pay/' + bookingId);
    });
});

app.get('/pay/:id', requireLogin, (req, res) => {
    const bookingId = req.params.id;
    const paymentString = "QRIS-PAYMENT-" + bookingId + "-RP50000";
    qrcode.toDataURL(paymentString, (err, url) => {
        if (err) return res.send("Error generating QRIS");
        res.render('payment', { booking: { id: bookingId }, qr_code: url });
    });
});

// --- CONFIRM PAY & SEND EMAIL (ASYNC) ---
app.post('/pay/confirm/:id', requireLogin, (req, res) => {
    const bookingId = req.params.id;
    const sqlUpdate = "UPDATE reservations SET status = 'confirmed', payment_status = 'paid' WHERE id = ?";
    
    db.query(sqlUpdate, [bookingId], (err, result) => {
        if (err) return res.send("Gagal verifikasi pembayaran.");

        const sqlGet = `SELECT r.*, u.name, u.email FROM reservations r JOIN users u ON r.user_id = u.id WHERE r.id = ?`;
        db.query(sqlGet, [bookingId], async (err, results) => {
            if (results.length === 0) return res.redirect('/dashboard');
            const data = results[0];
            const datePretty = new Date(data.reservation_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            const mailOptions = {
                from: '"DineDock System" <anjargaming06@gmail.com>',
                to: data.email,
                subject: '✅ Payment Received: DineDock Booking ' + bookingId,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd;">
                        <h2>PAYMENT SUCCESSFUL</h2>
                        <p>Halo ${data.name}, pembayaran booking meja ${data.table_id} berhasil.</p>
                        <br>
                        <a href="https://${APP_DOMAIN}/ticket/${bookingId}" style="background:#c5a059; color:white; padding:10px 20px; text-decoration:none;">
                            LIHAT E-TICKET
                        </a>
                    </div>
                `
            };

            try {
                await transporter.sendMail(mailOptions);
            } catch (error) {
                console.error("Gagal kirim email:", error);
            }
            res.redirect('/ticket/' + bookingId);
        });
    });
});

// --- TICKET & QR VERIFICATION ---

app.get('/ticket/:id', requireLogin, (req, res) => {
    const bookingId = req.params.id;
    const sql = `SELECT r.*, u.name, u.email FROM reservations r JOIN users u ON r.user_id = u.id WHERE r.id = ?`;
    
    db.query(sql, [bookingId], (err, results) => {
        if (err || results.length === 0) return res.send("Tiket tidak ditemukan!");
        const verifyUrl = `https://${APP_DOMAIN}/verify/${bookingId}`;
        qrcode.toDataURL(verifyUrl, (err, url) => {
            res.render('ticket', { booking: results[0], qr_code: url, user: req.session });
        });
    });
});

app.get('/verify/:id', (req, res) => {
    const bookingId = req.params.id;
    const sql = `SELECT r.*, u.name FROM reservations r JOIN users u ON r.user_id = u.id WHERE r.id = ?`;

    db.query(sql, [bookingId], (err, results) => {
        if (err || results.length === 0) return res.send("<h1>❌ QR Code Tidak Dikenali</h1>");
        res.render('verify', { booking: results[0], user: req.session.userId ? req.session : null });
    });
});

// --- ADMIN ROUTES ---

app.get('/admin', requireAdmin, (req, res) => {
    const sql = `SELECT r.*, u.name as user_name, u.phone as user_phone, DATE_FORMAT(r.reservation_date, '%d-%m-%Y') as reservation_date_fmt FROM reservations r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC`;
    db.query(sql, (err, results) => {
        if (err) throw err;
        // Hitung Statistik sederhana
        const paidBookings = results.filter(r => r.payment_status === 'paid');
        const totalRevenue = paidBookings.length * 50000;
        const totalGuests = results.length;
        let mobilCount = 0, motorCount = 0;
        results.forEach(r => {
            if (r.parking_slot_id) {
                if (r.parking_slot_id.startsWith('A')) mobilCount++;
                else if (r.parking_slot_id.startsWith('B')) motorCount++;
            }
        });
        const unpaidCount = results.filter(r => r.payment_status === 'unpaid').length;
        const paidCount = paidBookings.length;

        res.render('admin', { 
            reservations: results,
            stats: { revenue: totalRevenue, guests: totalGuests, mobil: mobilCount, motor: motorCount, paid: paidCount, unpaid: unpaidCount }
        });
    });
});

app.post('/admin/checkin/:id', requireAdmin, (req, res) => {
    db.query("UPDATE reservations SET status = 'checked_in' WHERE id = ?", [req.params.id], (err) => {
        res.redirect('/admin');
    });
});

app.post('/admin/cancel/:id', requireAdmin, (req, res) => {
    const bookingId = req.params.id;
    db.query("SELECT * FROM reservations WHERE id = ?", [bookingId], (err, results) => {
        if(results.length > 0) {
            const booking = results[0];
            db.query("DELETE FROM reservations WHERE id = ?", [bookingId]);
            db.query("UPDATE tables SET status = 'available' WHERE id = ?", [booking.table_id]);
            if(booking.parking_slot_id) db.query("UPDATE parking_slots SET status = 'available' WHERE id = ?", [booking.parking_slot_id]);
        }
        res.redirect('/admin');
    });
});

// --- SETUP & START SERVER (VERCEL COMPATIBLE) ---
const initDatabase = require('./config/setup'); 

// Jalankan initDB hanya jika dijalankan manual (Local), BUKAN di Vercel
if (require.main === module) {
    initDatabase();
    app.listen(PORT, () => {
        console.log(`\n🚀 Server berjalan di Port ${PORT}`);
        console.log(`🌍 Domain: https://${APP_DOMAIN}`);
    });
}

// Export app untuk Vercel (WAJIB)
module.exports = app;