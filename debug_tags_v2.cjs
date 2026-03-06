const fs = require('fs');
const content = fs.readFileSync('c:/Users/User/OneDrive - info@asset-transportation.com/Apps/KCI TruckLogix Pro/components/IntelligenceHub.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // This is a crude parser but might help
    const tokens = line.matchAll(/<(div|aside|header|footer|section|article|nav|main)\b|(\/>)|<\/(div|aside|header|footer|section|article|nav|main)>/g);
    for (const match of tokens) {
        if (match[0] === '/>') {
            if (stack.length > 0) stack.pop();
        } else if (match[0].startsWith('</')) {
            if (stack.length > 0) stack.pop();
        } else {
            stack.push({ tag: match[1], line: i + 1 });
        }
    }
}
console.log('Unclosed tags stack:');
stack.forEach(s => console.log(`${s.tag} at line ${s.line}`));
