import fs from 'fs';
const path = 'apps/platform/src/styles/forum.css';

try {
  let content = fs.readFileSync(path, 'utf8');
  
  // 1. Remove the garbage line and the extra brace
  // The pattern seen was: "   ============================================ */ansition: all var(--forum-transition-fast);" followed by "}"
  content = content.replace(/ansition: all var\(--forum-transition-fast\);[\s\S]*?\}/g, '');
  
  // 2. Squeeze multiple newlines into max 2 (to keep section breaks but not huge gaps)
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // 3. Also fix the specific pattern if it persists (sometimes regex above might miss if newlines are weird)
  content = content.replace(/ansition:[^;]+;/g, '');
  
  // 4. Remove specific stray } if it appears after the comment block navigation
  // Look for the pattern we saw in read_file
  // "   ============================================ */" then garbage
  
  fs.writeFileSync(path, content);
  console.log('Cleaned up ' + path);
  
} catch (e) {
  console.error(e);
}
