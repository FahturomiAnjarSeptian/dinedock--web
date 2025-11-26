// app.js (FINAL VERSION: GOOGLE AUTH SUPPORT)
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs'); 
const db = require('./config/database');
const qrcode = require('qrcode'); // Library QR

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(bodyParser.json()); // PENTING: Untuk baca data JSON dari Login Google

app.use(session({
    secret: 'kunci_rahasia_negara_api',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000 }
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
const nodemailer = require('nodemailer'); // Import Library

// --- KONFIGURASI PENGIRIM EMAIL (TUKANG POS) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'anjargaming06@gmail.com', // Ganti dengan email pengirim
        pass: 'jtjyoqtnskprfmrj'  // Ganti dengan App Password tadi (tanpa spasi)
    }
});

// --- ROUTES ---

// 1. Landing Page
app.get('/', (req, res) => {
    res.render('landing', { user: req.session.userId ? req.session : null });
});

// 2. Menu Page
app.get('/menu', (req, res) => {
    db.query("SELECT * FROM menus", (err, results) => {
        if (err) throw err;
        res.render('menu', { menus: results, user: req.session.userId ? req.session : null });
    });
});

// 3. Dashboard (Protected)
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
                tables: tablesResult, 
                mobil: mobil, 
                motor: motor,
                user: req.session 
            });
        });
    });
});

// --- AUTH ROUTES ---

app.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('login');
});

// Login Manual
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

// Register Manual
app.post('/register', (req, res) => {
    const { name, email, phone, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const sql = "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'customer')";
    db.query(sql, [name, email, phone, hashedPassword], (err, result) => {
        if (err) return res.render('login', { error: 'Email sudah terdaftar!' });
        res.render('login', { error: 'Registrasi Berhasil! Silakan Login.' });
    });
});

// 🔥 NEW: ROUTE KHUSUS GOOGLE LOGIN 🔥
app.post('/auth/google', (req, res) => {
    const { email, name, phone } = req.body;

    // 1. Cek apakah email ini sudah ada di MySQL?
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error(err);
            return res.sendStatus(500);
        }

        if (results.length > 0) {
            // KASUS A: User Sudah Ada -> Langsung Login
            req.session.userId = results[0].id;
            req.session.userName = results[0].name;
            req.session.role = results[0].role;
            return res.sendStatus(200); // Kirim kode SUKSES ke Frontend
        } else {
            // KASUS B: User Baru (Belum ada di MySQL) -> Registrasi Otomatis
            // Kita buat password dummy karena tabel butuh password not null
            const dummyPassword = bcrypt.hashSync("GOOGLE_ACCESS_TOKEN", 10);
            
            const sqlInsert = "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'customer')";
            db.query(sqlInsert, [name, email, phone, dummyPassword], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.sendStatus(500);
                }
                
                // Setelah register sukses, langsung login
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

// --- BOOKING & ADMIN ROUTES (SAMA SEPERTI SEBELUMNYA) ---

// --- LOGIKA BOOKING (UPDATE: KE PAYMENT DULU) ---
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

    // STATUS AWAL: 'pending_payment' (Bukan confirmed!)
    const sqlBooking = `INSERT INTO reservations 
        (id, user_id, table_id, parking_slot_id, reservation_date, start_time, end_time, status, payment_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')`;

    db.query(sqlBooking, [bookingId, userId, table_id, finalParkingId, date, startTime, endTime], (err, result) => {
        if (err) return res.send("Gagal Reservasi.");
        
        // JANGAN UPDATE STATUS MEJA DULU (Atau update 'pending' biar orang lain gak ambil, tapi warna kuning)
        // Disini kita anggap meja 'booked' sementara menunggu bayar
        db.query("UPDATE tables SET status = 'maintenance' WHERE id = ?", [table_id]);
        if (finalParkingId) db.query("UPDATE parking_slots SET status = 'maintenance' WHERE id = ?", [finalParkingId]);
        
        // REDIRECT KE HALAMAN PEMBAYARAN
        res.redirect('/pay/' + bookingId);
    });
});

// --- ROUTE HALAMAN BAYAR (UPDATE QR LOCAL) ---
app.get('/pay/:id', requireLogin, (req, res) => {
    const bookingId = req.params.id;
    
    // String yang akan dijadikan QR Code (Misal: Link pembayaran dummy)
    const paymentString = "QRIS-PAYMENT-" + bookingId + "-RP50000";

    // Generate QR Code secara lokal
    qrcode.toDataURL(paymentString, (err, url) => {
        if (err) return res.send("Error generating QRIS");
        
        // Kirim URL gambar QR ke halaman payment.ejs
        res.render('payment', { 
            booking: { id: bookingId },
            qr_code: url 
        });
    });
});
// --- PROSES KONFIRMASI BAYAR ---
// --- UPDATE: KONFIRMASI BAYAR + KIRIM EMAIL ---
app.post('/pay/confirm/:id', requireLogin, (req, res) => {
    const bookingId = req.params.id;

    // 1. Update Status jadi Paid
    const sqlUpdate = "UPDATE reservations SET status = 'confirmed', payment_status = 'paid' WHERE id = ?";
    
    db.query(sqlUpdate, [bookingId], (err, result) => {
        if (err) return res.send("Gagal verifikasi pembayaran.");

        // 2. AMBIL DATA USER & BOOKING (Untuk isi email)
        const sqlGet = `SELECT r.*, u.name, u.email 
                        FROM reservations r 
                        JOIN users u ON r.user_id = u.id 
                        WHERE r.id = ?`;

        db.query(sqlGet, [bookingId], (err, results) => {
            if (results.length === 0) return res.redirect('/dashboard');
            
            const data = results[0];

            // 3. SUSUN ISI EMAIL (HTML Cantik)
            const mailOptions = {
                from: '"DineDock System" <no-reply@dinedock.com>',
                to: data.email, // Kirim ke email user yang booking
                subject: '✅ E-Ticket Reservasi DineDock: ' + bookingId,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                        <div style="background-color: #1a1a1a; color: #c5a059; padding: 20px; text-align: center;">
                            <h2 style="margin: 0;">PAYMENT SUCCESSFUL</h2>
                        </div>
                        <div style="padding: 20px; background-color: #fff;">
                            <p>Halo <strong>${data.name}</strong>,</p>
                            <p>Terima kasih! Pembayaran Anda telah kami terima. Berikut detail reservasi Anda:</p>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; color: #666;">Booking ID</td>
                                    <td style="padding: 10px; font-weight: bold;">${bookingId}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; color: #666;">Tanggal</td>
                                    <td style="padding: 10px; font-weight: bold;">${new Date(data.reservation_date).toLocaleDateString()}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; color: #666;">Jam</td>
                                    <td style="padding: 10px; font-weight: bold;">${data.start_time}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; color: #666;">Meja</td>
                                    <td style="padding: 10px; font-weight: bold; color: #c5a059;">${data.table_id}</td>
                                </tr>
                            </table>

                            <div style="text-align: center; margin-top: 30px;">
                                <a href="http://localhost:3000/ticket/${bookingId}" style="background-color: #c5a059; color: #000; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 5px;">
                                    LIHAT E-TICKET & QR CODE
                                </a>
                                <p style="font-size: 12px; color: #999; margin-top: 20px;">
                                    Tunjukkan QR Code pada link di atas saat kedatangan.
                                </p>
                            </div>
                        </div>
                        <div style="background-color: #eee; padding: 10px; text-align: center; font-size: 12px; color: #666;">
                            &copy; 2025 DineDock Integrated System
                        </div>
                    </div>
                `
            };

            // 4. KIRIM EMAIL (Asynchronous - Jangan tunggu selesai baru redirect)
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Gagal kirim email:', error);
                } else {
                    console.log('Email terkirim: ' + info.response);
                }
            });

            // Langsung lempar user ke halaman tiket (Biar cepat)
            res.redirect('/ticket/' + bookingId);
        });
    });
});
app.get('/ticket/:id', requireLogin, (req, res) => {
    const bookingId = req.params.id;
    const sql = `SELECT r.*, u.name, u.email FROM reservations r JOIN users u ON r.user_id = u.id WHERE r.id = ?`;
    db.query(sql, [bookingId], (err, results) => {
        if (err || results.length === 0) return res.send("Tiket tidak ditemukan!");
        qrcode.toDataURL(bookingId, (err, url) => {
            res.render('ticket', { booking: results[0], qr_code: url, user: req.session });
        });
    });
});

// --- UPDATE ROUTE ADMIN (DENGAN ANALITIK DATA) ---
app.get('/admin', requireAdmin, (req, res) => {
    // Join tabel reservations dengan users
    const sql = `
        SELECT r.*, u.name as user_name, u.phone as user_phone, 
               DATE_FORMAT(r.reservation_date, '%d-%m-%Y') as reservation_date_fmt 
        FROM reservations r 
        JOIN users u ON r.user_id = u.id 
        ORDER BY r.created_at DESC`;

    db.query(sql, (err, results) => {
        if (err) throw err;

        // --- LOGIKA BUSINESS INTELLIGENCE (HITUNG DATA) ---
        
        // 1. Hitung Total Pendapatan (Hanya yang status 'paid')
        // Kita anggap 1 booking = Rp 50.000
        const paidBookings = results.filter(r => r.payment_status === 'paid');
        const totalRevenue = paidBookings.length * 50000;

        // 2. Hitung Total Tamu
        const totalGuests = results.length;

        // 3. Statistik Parkir (Mobil vs Motor)
        // Asumsi: Slot A = Mobil, Slot B = Motor
        let mobilCount = 0;
        let motorCount = 0;
        
        results.forEach(r => {
            if (r.parking_slot_id) {
                if (r.parking_slot_id.startsWith('A')) mobilCount++;
                else if (r.parking_slot_id.startsWith('B')) motorCount++;
            }
        });

        // 4. Statistik Pembayaran (Lunas vs Belum)
        const unpaidCount = results.filter(r => r.payment_status === 'unpaid').length;
        const paidCount = paidBookings.length;

        // Kirim semua data statistik ini ke Frontend (admin.ejs)
        res.render('admin', { 
            reservations: results,
            stats: {
                revenue: totalRevenue,
                guests: totalGuests,
                mobil: mobilCount,
                motor: motorCount,
                paid: paidCount,
                unpaid: unpaidCount
            }
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
// ... kode import yang lain ...
const initDatabase = require('./config/setup'); // Import file tadi

// ... kode route lainnya ...

// PANGGIL FUNGSI SETUP DATABASE SAAT SERVER NYALA
// (Letakkan tepat DI ATAS app.listen)
initDatabase(); 

app.listen(PORT, () => {
    console.log(`\n🚀 Server berjalan di http://localhost:${PORT}`);
});
app.listen(PORT, () => {
    console.log(`\n🚀 Server dengan Google Auth berjalan di http://localhost:${PORT}`);
});