import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string) {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.test.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('tests');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');

  // Fix syntax error with requireAdmin
  if (content.includes('requireAdmin: (req: any, res: any, next: any) => { next(); },\n')) {
    // maybe duplicated?
  }
  
  content = content.replace(/requireAdmin: \(req: any, res: any, next: any\) => \{ next\(\); \},/g, 'requireAdmin: (req: any, res: any, next: any) => { next(); }');

  // Also replace any standalone ones that were added incorrectly
  content = content.replace(/requireAdmin: \(req: any, res: any, next: any\) => \{ next\(\); \};\n/g, '');

  content = content.replace(/requireAuth:\s*\(.*?\)\s*=>\s*\{[^}]*\}/g, match => {
     if (match.includes('requireAdmin')) return match;
     return match + ',\n  requireAdmin: (req: any, res: any, next: any) => { next(); }';
  });

  // Fix status missing
  content = content.replace(/role: 'viewer',/g, "role: 'viewer',\n  status: 'ACTIVE',");
  content = content.replace(/role: "viewer",/g, "role: \"viewer\",\n  status: \"ACTIVE\",");
  content = content.replace(/role: 'admin',/g, "role: 'admin',\n  status: 'ACTIVE',");
  content = content.replace(/role: "admin",/g, "role: \"admin\",\n  status: \"ACTIVE\",");
  
  // Clean up duplicates if we ran it multiple times
  content = content.replace(/status: 'ACTIVE',\n\s*status: 'ACTIVE',/g, "status: 'ACTIVE',");
  content = content.replace(/status: "ACTIVE",\n\s*status: "ACTIVE",/g, "status: \"ACTIVE\",");

  fs.writeFileSync(f, content);
});
console.log('Fixed syntax and status');
