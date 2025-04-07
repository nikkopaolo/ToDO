const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Save tasks to file
app.post('/api/save-tasks', (req, res) => {
    const { tasks } = req.body;
    const filePath = path.join(dataDir, 'tasks.json');
    
    fs.writeFile(filePath, JSON.stringify(tasks, null, 2), (err) => {
        if (err) {
            res.status(500).json({ error: 'Failed to save tasks' });
            return;
        }
        res.json({ message: 'Tasks saved successfully' });
    });
});

// Load tasks from file
app.get('/api/load-tasks', (req, res) => {
    const filePath = path.join(dataDir, 'tasks.json');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.json({ tasks: [] });
            return;
        }
        res.json({ tasks: JSON.parse(data) });
    });
});

// Export tasks
app.get('/api/export-tasks', (req, res) => {
    const filePath = path.join(dataDir, 'tasks.json');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).json({ error: 'Failed to export tasks' });
            return;
        }
        
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            tasks: JSON.parse(data)
        };
        
        res.setHeader('Content-Disposition', 'attachment; filename=tasks_export.json');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
    });
});

// Import tasks
app.post('/api/import-tasks', (req, res) => {
    const { tasks } = req.body;
    const filePath = path.join(dataDir, 'tasks.json');
    
    fs.writeFile(filePath, JSON.stringify(tasks, null, 2), (err) => {
        if (err) {
            res.status(500).json({ error: 'Failed to import tasks' });
            return;
        }
        res.json({ message: 'Tasks imported successfully' });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 