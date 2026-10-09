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
      if (file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('tests/api');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('jest.mock(') && content.includes('requireAuth')) {
    if (!content.includes('requireAdmin:')) {
      content = content.replace(/requireAuth:\s*\(.*?\)\s*=>\s*\{[^}]*\}/g, match => {
        return match + ',\n  requireAdmin: (req: any, res: any, next: any) => { next(); }';
      });
      fs.writeFileSync(f, content);
      console.log('Fixed', f);
    }
  }
});
