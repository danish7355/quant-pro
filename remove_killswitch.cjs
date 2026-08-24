const fs = require('fs');
let code = fs.readFileSync('src/components/RiskCenter.tsx', 'utf8');
code = code.replace(/<h4 className="text-sm font-bold text-red-500 mb-3 flex items-center">[\s\S]*?Emergency Kill Switch<\/button>\n\s*<\/div>/, '');
code = code.replace(/const handleTriggerKillSwitch[\s\S]*?};\n/, '');
code = code.replace(/const \[killMessage, setKillMessage\] = useState<string \| null>\(null\);/, '');
code = code.replace(/\{killMessage && \([\s\S]*?\}\)/, '');
fs.writeFileSync('src/components/RiskCenter.tsx', code);
