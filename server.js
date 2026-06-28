const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database Connection Pool configuration
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

// Table Initialization Check
const initializeDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                age INT,
                course VARCHAR(150),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Database checked/ready.');
    } catch (err) {
        console.error('Database connection failed:', err.message);
    }
};
initializeDatabase();

// Input Validation Helper
const validateInput = (body) => {
    const { firstName, lastName, email, age, course } = body;
    let errors = [];
    if (!firstName || firstName.trim() === '') errors.push('First name is required');
    if (!lastName || lastName.trim() === '') errors.push('Last name is required');
    if (!email || !/\S+@\S+\.\S+/.test(email)) errors.push('Valid email format is required');
    if (age && (isNaN(age) || age < 1 || age > 150)) errors.push('Age must be between 1 and 150');
    if (firstName?.length > 100 || lastName?.length > 100) errors.push('Names must be under 100 chars');
    if (email?.length > 150 || course?.length > 150) errors.push('Fields must be under 150 chars');
    return errors;
};

// 📋 --- API REST ENDPOINTS ---

// GET (Read)
app.get('/api/students', async (req, res) => {
    try {
        const { id } = req.query;
        if (id) {
            const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
            return res.json({ success: true, data: rows[0] });
        }
        const [rows] = await pool.query('SELECT * FROM students ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'DB Error: ' + err.message });
    }
});

// POST (Create)
app.post('/api/students', async (req, res) => {
    const errors = validateInput(req.body);
    if (errors.length > 0) return res.status(400).json({ success: false, message: errors.join(', ') });
    const { firstName, lastName, email, age, course } = req.body;
    try {
        const [dup] = await pool.query('SELECT id FROM students WHERE email = ?', [email]);
        if (dup.length > 0) return res.status(409).json({ success: false, message: 'Email already exists' });

        const [result] = await pool.query(
            'INSERT INTO students (first_name, last_name, email, age, course) VALUES (?, ?, ?, ?, ?)',
            [firstName, lastName, email, age || null, course || null]
        );
        res.status(201).json({ success: true, message: 'Student created successfully', data: { id: result.insertId } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'DB Error: ' + err.message });
    }
});

// PUT (Update)
app.put('/api/students/:id', async (req, res) => {
    const { id } = req.params;
    const errors = validateInput(req.body);
    if (errors.length > 0) return res.status(400).json({ success: false, message: errors.join(', ') });
    const { firstName, lastName, email, age, course } = req.body;
    try {
        const [exists] = await pool.query('SELECT id FROM students WHERE id = ?', [id]);
        if (exists.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });

        const [dupEmail] = await pool.query('SELECT id FROM students WHERE email = ? AND id != ?', [email, id]);
        if (dupEmail.length > 0) return res.status(409).json({ success: false, message: 'Email taken by another student' });

        await pool.query(
            'UPDATE students SET first_name = ?, last_name = ?, email = ?, age = ?, course = ? WHERE id = ?',
            [firstName, lastName, email, age || null, course || null, id]
        );
        res.json({ success: true, message: 'Student updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'DB Error: ' + err.message });
    }
});

// DELETE (Delete)
app.delete('/api/students/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [exists] = await pool.query('SELECT id FROM students WHERE id = ?', [id]);
        if (exists.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });

        await pool.query('DELETE FROM students WHERE id = ?', [id]);
        res.json({ success: true, message: 'Student removed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'DB Error: ' + err.message });
    }
});

// Export the app context for Vercel
module.exports = app;

// Listen locally
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}