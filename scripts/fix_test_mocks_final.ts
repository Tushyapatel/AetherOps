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

  // Fix MOCK_SAFE_USER in auth.test.ts, awsCollector.test.ts, etc.
  content = content.replace(/status:\s*['"]ACTIVE['"],\s*as\s*const,/g, "status: 'ACTIVE' as const,");
  content = content.replace(/status:\s*['"]ACTIVE['"],\s*\n\s*as\s*const,/g, "status: 'ACTIVE' as const,");

  // Fix the broken mock structure
  content = content.replace(/req\.user = \{ id: 1, email: 'test@example\.com', role: 'viewer',\s*status: 'ACTIVE', \},?\s*next\(\);/g,
    "req.user = { id: 1, email: 'test@example.com', role: 'viewer', status: 'ACTIVE' };\n      next();");

  content = content.replace(/req\.user = \{ id: 1, email: 'test@example\.com', role: 'admin',\s*status: 'ACTIVE', \},?\s*next\(\);/g,
    "req.user = { id: 1, email: 'test@example.com', role: 'admin', status: 'ACTIVE' };\n      next();");

  // Ensure requireAdmin is exported in the mock block if we see requireAuth
  // Look for the end of requireAuth function: },
  // And replace it with }, requireAdmin: (req: any, res: any, next: any) => { next(); }
  
  if (content.includes('jest.mock(') && content.includes('requireAuth:')) {
    if (!content.includes('requireAdmin:')) {
      content = content.replace(/requireAuth:\s*\(.*?=>\s*\{[\s\S]*?\}\s*\},/g,
        "$& requireAdmin: (req: any, res: any, next: any) => { next(); },");
      
      // If it doesn't have a trailing comma at the end of the block
      content = content.replace(/(\}\s*\}\s*)\)\s*;\s*$/gm, (match, p1) => {
        if (content.includes('requireAdmin:')) return match;
        return `}, requireAdmin: (req: any, res: any, next: any) => { next(); } }));`;
      });
    }
  }

  // Fallback for files that use `jest.mock('../../src/api/v1/auth/auth.middleware', () => { return { requireAuth: ... } });`
  if (content.includes('requireAuth:') && !content.includes('requireAdmin:')) {
      content = content.replace(/requireAuth:\s*jest\.fn\((.*?)\),?/g,
        "requireAuth: jest.fn($1),\n  requireAdmin: jest.fn((req, res, next) => next()),");
  }

  fs.writeFileSync(f, content);
});

console.log('Fixed syntax and requireAdmin in tests!');
