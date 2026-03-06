const fs = require('fs');
const content = fs.readFileSync('c:/Users/User/OneDrive - info@asset-transportation.com/Apps/KCI TruckLogix Pro/components/IntelligenceHub.tsx', 'utf8');
const lines = content.split('\n');

const trackedTags = ['div', 'aside', 'header', 'footer', 'section', 'article', 'nav', 'main', 'TriageItem'];
const tagRegex = new RegExp(`<(/?(${trackedTags.join('|')})|\\w+)\\b[^>]*?(/>|>)`, 'g');

let stack = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
        const fullMatch = match[0];
        const tagName = match[2];
        const isClosing = fullMatch.startsWith('</');
        const isSelfClosing = fullMatch.endsWith('/>');

        if (tagName && trackedTags.includes(tagName)) {
            if (isClosing) {
                if (stack.length === 0) {
                    console.log(`Error: Extra closing tag </${tagName}> at line ${i + 1}`);
                } else {
                    const last = stack.pop();
                    if (last.tag !== tagName) {
                        console.log(`Error: Mismatched tag. Expected </${last.tag}> but found </${tagName}> at line ${i + 1}`);
                    }
                }
            } else if (isSelfClosing) {
                // Self-closing of a tracked tag - do nothing (push then pop effectively)
            } else {
                stack.push({ tag: tagName, line: i + 1 });
            }
        }
    }
}
console.log('Final Stack size:', stack.length);
stack.slice(-10).forEach(s => console.log(`${s.tag} at line ${s.line}`));
