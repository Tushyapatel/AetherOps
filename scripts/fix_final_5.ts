import * as fs from 'fs';

const files = [
  'tests/api/pricingApi.hardening.test.ts',
  'tests/api/phase15.integration.test.ts',
  'tests/api/pricingApi.comprehensive.test.ts',
  'tests/api/reportApi.test.ts',
  'tests/api/pricingApi.test.ts'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  // Cleanly replace the ENTIRE mock block because the regex is brittle.
  const badMock = `jest.mock('../../src/api/v1/auth/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.cookie?.includes('atherops_token=valid')) {
      req.user = { id: 1, email: 'test@example.com', role: 'viewer' as const, status: 'ACTIVE' };
      next();
    } else {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
  }
}));`;

  const goodMock = `jest.mock('../../src/api/v1/auth/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.cookie?.includes('atherops_token=valid')) {
      req.user = { id: 1, email: 'test@example.com', role: 'viewer' as const, status: 'ACTIVE' };
      next();
    } else {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
  },
  requireAdmin: (req: any, res: any, next: any) => { next(); }
}));`;

  if (content.includes(badMock)) {
    content = content.replace(badMock, goodMock);
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  } else {
    console.log('Could not find bad mock in', f);
  }
});

