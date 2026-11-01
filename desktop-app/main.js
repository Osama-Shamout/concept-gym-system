const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let mainWindow;

// مسار قاعدة البيانات
const dbPath = path.join(__dirname, 'gym_database.sqlite');
const db = new sqlite3.Database(dbPath);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 850,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');
}

// إنشاء الجداول الجديدة شاملة الأقساط والمعلومات الإضافية
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        notes TEXT,
        credits REAL DEFAULT 0,
        sessions INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        date TEXT,
        time TEXT,
        credits_deducted REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS finance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        amount REAL,
        package_name TEXT,
        date TEXT
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        date TEXT,
        time TEXT
    )`);

    // جدول الأقساط
    db.run(`CREATE TABLE IF NOT EXISTS installments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        amount REAL,
        due_date TEXT,
        is_paid INTEGER DEFAULT 0,
        paid_date TEXT
    )`);
});

// --- إضافة، تعديل، وحذف المشتركين ---
ipcMain.handle('add-member', async (event, member) => {
    return new Promise((resolve) => {
        db.run("INSERT INTO members (first_name, last_name, phone, email, notes, credits, sessions, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')",
            [member.firstName, member.lastName, member.phone, member.email, member.notes, member.credits, member.sessions], function(err) {
                if (err) resolve({ success: false, error: err.message });
                else resolve({ success: true, id: this.lastID });
            });
    });
});

ipcMain.handle('edit-member', async (event, member) => {
    return new Promise((resolve) => {
        db.run("UPDATE members SET first_name=?, last_name=?, phone=?, email=?, notes=? WHERE id=?",
            [member.firstName, member.lastName, member.phone, member.email, member.notes, member.id], function(err) {
                if (err) resolve({ success: false, error: err.message });
                else resolve({ success: true });
            });
    });
});

ipcMain.handle('delete-member', async (event, memberId) => {
    return new Promise((resolve) => {
        db.run("DELETE FROM members WHERE id=?", [memberId], function(err) {
            resolve(!err);
        });
    });
});

ipcMain.handle('get-members', async () => {
    return new Promise((resolve) => {
        db.all("SELECT * FROM members ORDER BY id DESC", [], (err, rows) => resolve(rows || []));
    });
});

// --- نظام الحجز والحضور ---
ipcMain.handle('book-appointment', async (event, { memberId, date, timeStr }) => {
    return new Promise((resolve) => {
        db.get("SELECT credits, status FROM members WHERE id = ?", [memberId], (err, member) => {
            if (!member || member.status === 'Frozen') return resolve({ success: false, msg: "المشترك غير موجود أو حسابه مجمد" });
            const [hours, minutes] = timeStr.split(':').map(Number);
            const timeVal = hours + minutes / 60;
            let requiredCredits = 1.0; 
            if ((timeVal >= 6 && timeVal <= 9.5) || (timeVal >= 16.5 && timeVal <= 20.5)) requiredCredits = 1.5;

            if (member.credits < requiredCredits) return resolve({ success: false, msg: `الرصيد غير كافٍ! وقت الذروة يحتاج ${requiredCredits} نقطة.` });

            db.serialize(() => {
                db.run("UPDATE members SET credits = credits - ? WHERE id = ?", [requiredCredits, memberId]);
                db.run("INSERT INTO appointments (member_id, date, time, credits_deducted) VALUES (?, ?, ?, ?)", [memberId, date, timeStr, requiredCredits]);
                resolve({ success: true, msg: `تم الحجز بنجاح! خُصم ${requiredCredits} نقطة.` });
            });
        });
    });
});

ipcMain.handle('log-attendance', async (event, { memberId, date, time }) => {
    return new Promise((resolve) => {
        db.run("INSERT INTO attendance (member_id, date, time) VALUES (?, ?, ?)", [memberId, date, time], (err) => resolve(!err));
    });
});

// --- المالية والأقساط ---
ipcMain.handle('add-transaction', async (event, { memberId, amount, packageName, date, credits, sessions }) => {
    return new Promise((resolve) => {
        db.serialize(() => {
            db.run("INSERT INTO finance (member_id, amount, package_name, date) VALUES (?, ?, ?, ?)", [memberId, amount, packageName, date]);
            db.run("UPDATE members SET credits = credits + ?, sessions = sessions + ? WHERE id = ?", [credits, sessions, memberId]);
            resolve(true);
        });
    });
});

ipcMain.handle('get-financial-report', async () => {
    return new Promise((resolve) => {
        db.all("SELECT f.*, m.first_name, m.last_name FROM finance f JOIN members m ON f.member_id = m.id ORDER BY f.id DESC", [], (err, rows) => {
            let totalRevenue = rows ? rows.reduce((sum, row) => sum + row.amount, 0) : 0;
            resolve({ totalRevenue, transactions: rows || [] });
        });
    });
});

// إدارة الأقساط
ipcMain.handle('add-installment', async (event, { memberId, amount, dueDate }) => {
    return new Promise((resolve) => {
        db.run("INSERT INTO installments (member_id, amount, due_date) VALUES (?, ?, ?)", [memberId, amount, dueDate], err => resolve(!err));
    });
});

ipcMain.handle('get-installments', async () => {
    return new Promise((resolve) => {
        db.all("SELECT i.*, m.first_name, m.last_name FROM installments i JOIN members m ON i.member_id = m.id ORDER BY i.is_paid ASC, i.due_date ASC", [], (err, rows) => {
            resolve(rows || []);
        });
    });
});

ipcMain.handle('pay-installment', async (event, { installmentId, amount, memberId }) => {
    return new Promise((resolve) => {
        const today = new Date().toLocaleDateString('en-CA');
        db.serialize(() => {
            // تحديث حالة القسط لمدفوع
            db.run("UPDATE installments SET is_paid = 1, paid_date = ? WHERE id = ?", [today, installmentId]);
            // تسجيل الدفعة في السجل المالي العام
            db.run("INSERT INTO finance (member_id, amount, package_name, date) VALUES (?, ?, ?, ?)", [memberId, amount, "دفع قسط", today]);
            resolve(true);
        });
    });
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });