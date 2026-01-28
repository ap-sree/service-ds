const fs = require('fs');
const path = require('path');

class FileService {

    /**
     * Reads a local file and parses it.
     * @param {string} filePath - Absolute path to the file.
     * @param {string} format - 'json' | 'csv' | 'auto'.
     * @returns {Promise<any[]>}
     */
    async readFile(filePath, format = 'auto') {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            throw new Error(`Path is not a file: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');

        let parseFormat = format;
        if (format === 'auto') {
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.json') parseFormat = 'json';
            else if (ext === '.csv') parseFormat = 'csv';
            else parseFormat = 'text';
        }

        return this._parseContent(content, parseFormat);
    }

    _parseContent(content, format) {
        if (format === 'json') {
            try {
                const parsed = JSON.parse(content);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                console.error('JSON Parse Error', e);
                // Try parsing line-by-line (NDJSON)
                const lines = content.trim().split(/\r?\n/);
                try {
                    return lines.map(line => JSON.parse(line));
                } catch (e2) {
                    throw new Error('Invalid JSON content');
                }
            }
        } else if (format === 'csv') {
            const lines = content.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length < 2) return []; // Header + 1 row minimum

            // Simple CSV Parser (Assumes header row, comma separated, quotes handling is basic)
            // Note: For robust CSV parsing, a library like 'csv-parse' is recommended.
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

            return lines.slice(1).map(line => {
                // This basic split doesn't handle commas inside quotes correctly.
                // Sufficient for simple CSVs.
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                let row = {};
                headers.forEach((h, i) => {
                    row[h] = values[i] !== undefined ? values[i] : null;
                });
                return row;
            });
        } else {
            // Text / Unknown
            const lines = content.trim().split(/\r?\n/);
            return lines.map((line, index) => ({ line: index + 1, content: line }));
        }
    }
}

module.exports = new FileService();
