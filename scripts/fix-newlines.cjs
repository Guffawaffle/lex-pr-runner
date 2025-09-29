#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get tracked files (respects .gitignore)
const out = execSync('git ls-files', { encoding: 'utf8' });
const files = out.split('\n').filter(Boolean);
let changed = 0;
files.forEach((f) => {
    // skip binary-ish files by extension heuristics
    const ext = path.extname(f).toLowerCase();
    const binaryExt = ['.png', '.jpg', '.jpeg', '.gif', '.zip', '.gz', '.tgz', '.ico', '.pdf', '.exe', '.dll', '.so'];
    if (binaryExt.includes(ext)) return;
    try {
        const stat = fs.statSync(f);
        if (!stat.isFile()) return;
        let content = fs.readFileSync(f);
        // if file already ends with newline (\n) do nothing
        if (content.length === 0) return;
        if (content[content.length - 1] === 0x0a) return;
        // append newline
        fs.appendFileSync(f, '\n');
        changed++;
        console.log('Fixed newline:', f);
    } catch (err) {
        // ignore errors (e.g., permission)
    }
});
if (changed > 0) {
    console.log(`Added trailing newline to ${changed} files.`);
    process.exit(0);
} else {
    console.log('No changes needed.');
    process.exit(0);
}
