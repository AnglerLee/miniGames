/* ===== file-store.js - JSON File Read/Write Utilities ===== */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Ensure data directory exists on load
ensureDir(DATA_DIR);
ensureDir(path.join(DATA_DIR, 'game-settings'));
ensureDir(path.join(DATA_DIR, 'uploads'));

function readJSON(filename) {
    const filePath = path.join(DATA_DIR, filename);
    try {
        if (!fs.existsSync(filePath)) return null;
        const data = fs.readFileSync(filePath, 'utf8');
        if (!data || data.trim() === '') return null;
        return JSON.parse(data);
    } catch (e) {
        console.error('readJSON error:', filename, e.message);
        return null;
    }
}

function writeJSON(filename, data) {
    const filePath = path.join(DATA_DIR, filename);
    try {
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        ensureDir(dir);

        // Atomic write: write to temp file then rename
        const tempPath = filePath + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, filePath);
        return true;
    } catch (e) {
        console.error('writeJSON error:', filename, e.message);
        return false;
    }
}

module.exports = { readJSON, writeJSON, ensureDir };
