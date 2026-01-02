const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// --- API Endpoints ---

// Get all projects
app.get('/api/projects', (req, res) => {
    const query = 'SELECT * FROM projects ORDER BY createdAt DESC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add a new project
app.post('/api/projects', (req, res) => {
    const { id, name, client, startDate, endDate, amount, status, paymentStatus, paidAmount } = req.body;
    const query = `INSERT INTO projects (id, name, client, startDate, endDate, amount, status, paymentStatus, paidAmount) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(query, [id, name, client, startDate, endDate, amount, status, paymentStatus, paidAmount], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Project added successfully', id });
    });
});

// Update a project
app.put('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    const { name, client, startDate, endDate, amount, status, paymentStatus, paidAmount } = req.body;
    const query = `UPDATE projects SET name=?, client=?, startDate=?, endDate=?, amount=?, status=?, paymentStatus=?, paidAmount=? 
                   WHERE id=?`;
    
    db.query(query, [name, client, startDate, endDate, amount, status, paymentStatus, paidAmount, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Project updated successfully' });
    });
});

// Delete a project
app.delete('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM projects WHERE id=?';
    
    db.query(query, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Project deleted successfully' });
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
