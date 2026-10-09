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

const files = walk('tests/api');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  if (content.includes('role: \'viewer\',')) {
    content = content.replace(/role: 'viewer',/g, "role: 'viewer',\n  status: 'ACTIVE',");
    changed = true;
  }
  
  if (content.includes('role: \'admin\',')) {
    content = content.replace(/role: 'admin',/g, "role: 'admin',\n  status: 'ACTIVE',");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(f, content);
    console.log('Fixed status in', f);
  }
});
