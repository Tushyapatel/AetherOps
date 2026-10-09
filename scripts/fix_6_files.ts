import * as fs from 'fs';

const files = [
  'tests/api/pricingApi.hardening.test.ts',
  'tests/api/phase15.integration.test.ts',
  'tests/api/pricingApi.comprehensive.test.ts',
  'tests/api/reportApi.test.ts',
  'tests/api/billingApi.test.ts',
  'tests/api/pricingApi.test.ts'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  if (content.includes('requireAuth:') && !content.includes('requireAdmin:')) {
    content = content.replace(/requireAuth:\s*\(req:\s*any,\s*res:\s*any,\s*next:\s*any\)\s*=>\s*\{([\s\S]*?)next\(\);\s*\}\s*\}\)\);/,
      "requireAuth: (req: any, res: any, next: any) => {$1next();\n  },\n  requireAdmin: (req: any, res: any, next: any) => { next(); }\n}));");
  }
  
  fs.writeFileSync(f, content);
});

console.log('Fixed the last 6 files');
