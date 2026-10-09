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

  // Fix role: 'viewer',
  content = content.replace(/role: 'viewer',/g, "role: 'viewer' as const,");
  content = content.replace(/role: 'admin',/g, "role: 'admin' as const,");

  // Fix phase15.integration.test.ts and others where requireAdmin was injected into json()
  content = content.replace(/res\.status\(401\)\.json\(\{\s*success:\s*false,\s*error:\s*\{\s*message:\s*'Unauthorized'\s*\},?\s*requireAdmin:\s*\(req:\s*any,\s*res:\s*any,\s*next:\s*any\)\s*=>\s*\{\s*next\(\);\s*\}\s*\}\)\);/g,
    "res.status(401).json({ success: false, error: { message: 'Unauthorized' } });");
  
  content = content.replace(/res\.status\(401\)\.json\(\{\s*success:\s*false,\s*error:\s*\{\s*message:\s*'Unauthorized'\s*\}\s*\}\)\);\s*requireAdmin:\s*\(req:\s*any,\s*res:\s*any,\s*next:\s*any\)\s*=>\s*\{\s*next\(\);\s*\}\s*\}\)\);/g,
    "res.status(401).json({ success: false, error: { message: 'Unauthorized' } });\n  },\n  requireAdmin: (req: any, res: any, next: any) => { next(); }\n}));");

  // General catch to make sure requireAdmin exists correctly
  // First clean up ANY trailing junk in mock
  content = content.replace(/res\.status\(401\)\.json\(\{\s*success:\s*false,\s*error:\s*\{\s*message:\s*'Unauthorized'\s*\}\s*\}\)\)(.*?)requireAdmin:(.*?)\}\)\);/gs, 
    "res.status(401).json({ success: false, error: { message: 'Unauthorized' } });\n    }\n  },\n  requireAdmin: (req: any, res: any, next: any) => { next(); }\n}));");

  fs.writeFileSync(f, content);
});

console.log('Fixed role typing and requireAdmin trailing errors');
