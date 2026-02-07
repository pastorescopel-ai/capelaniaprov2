
const fs = require('fs');
const path = require('path');

const npmrcPath = path.resolve(process.cwd(), '.npmrc');
const cleanContent = "# @generated clean-npm-config\n# This file ensures npm utilizes pure ASCII config.";

console.log("🔍 Starting .npmrc integrity audit...");

function repair() {
    console.log("⚠️ Corruption detected. Initiating auto-repair...");
    try {
        fs.writeFileSync(npmrcPath, cleanContent, { encoding: 'utf8' });
        console.log("✅ REPAIRED: .npmrc has been reset to clean ASCII.");
    } catch (writeErr) {
        console.error("❌ FAILED TO REPAIR: " + writeErr.message);
        process.exit(1);
    }
}

try {
  if (fs.existsSync(npmrcPath)) {
    const buffer = fs.readFileSync(npmrcPath);
    let isCorrupted = false;

    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        isCorrupted = true;
    }

    if (!isCorrupted) {
        for (let i = 0; i < buffer.length; i++) {
            const byte = buffer[i];
            if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte > 126) {
                 isCorrupted = true;
                 break;
            }
        }
    }

    if (isCorrupted) repair();
    else console.log("✅ SUCCESS: .npmrc is clean.");
  } else {
    repair();
  }
} catch (e) {
  repair();
}
process.exit(0);
