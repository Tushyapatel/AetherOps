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

  // Fix status missing
  if (content.includes('role: \'viewer\',')) {
    if (!content.includes('status: \'ACTIVE\'')) {
      content = content.replace(/role: 'viewer',/g, "role: 'viewer',\n  status: 'ACTIVE',");
    }
  }
  
  if (content.includes('role: \'admin\',')) {
    if (!content.includes('status: \'ACTIVE\'')) {
      content = content.replace(/role: 'admin',/g, "role: 'admin',\n  status: 'ACTIVE',");
    }
  }
  
  if (content.includes('role: "viewer",')) {
    if (!content.includes('status: "ACTIVE"')) {
      content = content.replace(/role: "viewer",/g, "role: \"viewer\",\n  status: \"ACTIVE\",");
    }
  }

  // Fix requireAdmin outside object syntax error
  // Replace the broken requireAdmin injection
  if (content.includes('requireAdmin: (req: any, res: any, next: any) => { next(); };')) {
     content = content.replace(/requireAdmin: \(req: any, res: any, next: any\) => \{ next\(\); \};/g, 'requireAdmin: (req: any, res: any, next: any) => { next(); },');
  }

  // Find all jest.mock('../../src/api/v1/auth/auth.middleware'
  if (content.includes('jest.mock(') && content.includes('auth.middleware')) {
    if (!content.includes('requireAdmin:')) {
      content = content.replace(/requireAuth:\s*\(.*?\)\s*=>\s*\{[^}]*\}/g, match => {
        return match + ',\n  requireAdmin: (req: any, res: any, next: any) => { next(); }';
      });
    }
  }

  fs.writeFileSync(f, content);
});
console.log('Fixed tests');
