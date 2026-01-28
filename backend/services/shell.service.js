const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ShellService {

    /**
     * Executes a command (single or multi-line) and returns parsed data.
     * @param {string} commandScript - The command to run.
     * @param {string} format - 'json' | 'csv' | 'text' (default 'text')
     * @returns {Promise<any[]>}
     */
    async execute(commandScript, format = 'text') {
        const isMultiLine = commandScript.includes('\n');
        let cmdToRun = commandScript;
        let tempFile = null;

        try {
            // Handle Multi-line OR Single Line: Always Write to Temp File for Consistency
            // This ensures PowerShell commands like 'Get-Service' work without explicit 'powershell -c' wrapper.
            if (true) {
                const ext = os.platform() === 'win32' ? '.ps1' : '.sh';
                tempFile = path.join(os.tmpdir(), `cmd_${Date.now()}${ext}`);
                fs.writeFileSync(tempFile, commandScript);

                if (os.platform() === 'win32') {
                    // Bypass policy to allow running the temp script
                    cmdToRun = `powershell -ExecutionPolicy Bypass -File "${tempFile}"`;
                } else {
                    cmdToRun = `bash "${tempFile}"`;
                }
            }

            const stdout = await this._execPromise(cmdToRun);

            // Parse Output
            return this._parseOutput(stdout, format);

        } finally {
            // Cleanup Temp File
            if (tempFile && fs.existsSync(tempFile)) {
                try { fs.unlinkSync(tempFile); } catch (e) { }
            }
        }
    }

    _execPromise(cmd) {
        return new Promise((resolve, reject) => {
            exec(cmd, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => { // 5MB limit
                if (error) {
                    console.error(`Exec Error: ${stderr}`);
                    reject(new Error(stderr || error.message));
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    _parseOutput(output, format) {
        const lines = output.trim().split(/\r?\n/).filter(l => l.trim().length > 0);

        if (format === 'json') {
            try {
                // Try parsing the whole output as JSON
                return JSON.parse(output);
            } catch (e) {
                // Try parsing each line as JSON object
                try {
                    return lines.map(l => JSON.parse(l));
                } catch (e2) {
                    // Failover
                    console.warn('JSON Parse failed, returning raw text lines');
                    return lines.map(l => ({ line: l }));
                }
            }
        } else if (format === 'csv') {
            if (lines.length < 2) return [];
            // Simple CSV Parser (Assumes header row)
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            return lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                let row = {};
                headers.forEach((h, i) => row[h] = values[i] || '');
                return row;
            });
        } else {
            // Text: Return as objects
            return lines.map(line => ({ output: line }));
        }
    }
}

module.exports = new ShellService();
