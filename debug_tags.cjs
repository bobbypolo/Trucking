const fs = require('fs');
const path = 'c:/Users/User/OneDrive - info@asset-transportation.com/Apps/KCI TruckLogix Pro/components/IntelligenceHub.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

let stack = [];
let totalErrors = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Find all <div or <aside or <header or <footer
    const opens = line.matchAll(/<(div|aside|header|footer|section|article|nav|main|TriageItem)\b/g);
    for (const match of opens) {
        stack.push({ tag: match[1], line: i + 1 });
    }

    // Find all </div or </aside or </header or </footer
    const closes = line.matchAll(/<\/(div|aside|header|footer|section|article|nav|main|TriageItem)>/g);
    for (const match of closes) {
        if (stack.length === 0) {
            console.log(`Error: Extra closing tag </${match[1]}> at line ${i + 1}`);
            totalErrors++;
        } else {
            const last = stack.pop();
            if (last.tag !== match[1]) {
                // Ignore mismatch for now as we are looking for unclosed
                // console.log(`Warning: Mismatched tags <${last.tag}> at line ${last.line} with </${match[1]}> at line ${i+1}`);
                // Put it back if we think it's just a mismatch
                stack.push(last);
            }
        }
    }
}

console.log('Unclosed tags:');
stack.forEach(s => console.log(`${s.tag} at line ${s.line}`));
