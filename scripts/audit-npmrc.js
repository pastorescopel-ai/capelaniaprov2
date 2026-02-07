
import fs from 'fs';
import path from 'path';

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
        // Only fail if we absolutely cannot write to the file system
        process.exit(1);
    }
}

try {
  if (fs.existsSync(npmrcPath)) {
    const buffer = fs.readFileSync(npmrcPath);
    let isCorrupted = false;

    // Check 1: BOM (Byte Order Mark - EF BB BF) detection
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        console.log("⚠️ BOM (Byte Order Mark) detected.");
        isCorrupted = true;
    }

    // Check 2: Non-ASCII characters (Strict mode)
    if (!isCorrupted) {
        for (let i = 0; i < buffer.length; i++) {
            const byte = buffer[i];
            // Allow: Tab (9), New Line (10), Carriage Return (13), and printable ASCII (32-126)
            if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte > 126) {
                 console.log(`⚠️ Invalid character detected at position ${i} (code ${byte}).`);
                 isCorrupted = true;
                 break;
            }
        }
    }

    if (isCorrupted) {
        repair();
    } else {
        console.log("✅ SUCCESS: .npmrc is clean and ASCII/UTF-8 compatible.");
    }
  } else {
    // If missing, create it to prevent future issues/warnings
    console.log("ℹ️ .npmrc missing. Creating clean file...");
    repair();
  }
} catch (e) {
  console.error("❌ ERROR reading .npmrc: " + e.message);
  repair();
}

// Always exit with success to allow the build to proceed after repair
process.exit(0);
