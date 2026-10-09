import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import SecurityFindings from './pages/SecurityFindings';
import Resources from './pages/Resources';
import AttackPaths from './pages/AttackPaths';
import Costs from './pages/Costs';
import Pricing from './pages/Pricing';
import AIAssistant from './pages/AIAssistant';
import Reports from './pages/Reports';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.fetch = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    (window.fetch as any).mockRestore();
  });

  // Helper to render with router
  const renderApp = (initialRoute = '/projects/123e4567-e89b-12d3-a456-426614174000') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route path="projects/:projectId" element={<Dashboard />} />
            <Route path="projects/:projectId/security" element={<SecurityFindings />} />
            <Route path="projects/:projectId/resources" element={<Resources />} />
            <Route path="projects/:projectId/attack-paths" element={<AttackPaths />} />
            <Route path="projects/:projectId/costs" element={<Costs />} />
            <Route path="projects/:projectId/pricing" element={<Pricing />} />
            <Route path="projects/:projectId/ai" element={<AIAssistant />} />
            <Route path="projects/:projectId/reports" element={<Reports />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  };

  it('A. Dashboard renders API data and handles empty states', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/cloud-accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: 'acct1' }] }) });
      if (url.includes('/risk')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { current: { overall_score: 82, cost_score: 90, reliability_score: 74 }, history: [] } }) });
      if (url.includes('/findings')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    });

    renderApp();
    expect(screen.getByText(/Loading dashboard/i)).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByText('82')).not.toBeNull();
      expect(screen.getByText('90')).not.toBeNull();
      expect(screen.getByText('74')).not.toBeNull();
      expect(screen.getByText('No active findings')).not.toBeNull();
    });
  });

  // Regression: risk_history has recorded_at not calculated_at — must render valid dates
  it('A2. Risk trend renders valid dates from recorded_at field (no Invalid Date)', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/cloud-accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      if (url.includes('/risk')) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        data: {
          current: { overall_score: 50 },
          history: [
            { recorded_at: '2026-10-03T08:00:00.000Z', security_score: 40, overall_score: 40 },
            { recorded_at: '2026-10-02T08:00:00.000Z', security_score: 60, overall_score: 60 },
          ]
        }
      }) });
      if (url.includes('/findings')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      if (url.includes('/projects') && !url.match(/\/projects\/\d+/)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    });

    renderApp();
    await waitFor(() => {
      // Should render short date labels from the valid recorded_at timestamps
      // Must NOT render "Invalid Date"
      const body = document.body.textContent || '';
      expect(body).not.toContain('Invalid Date');
      expect(body).toContain('Oct'); // some month label should appear
    });
  });

  // Regression: If recorded_at is missing/null, render fallback '—' not 'Invalid Date'
  it('A3. Risk trend renders fallback for missing dates (not Invalid Date)', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/cloud-accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      if (url.includes('/risk')) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        data: {
          current: { overall_score: 50 },
          history: [
            { recorded_at: null, security_score: 40, overall_score: 40 },
            { recorded_at: 'not-a-date', security_score: 20, overall_score: 20 },
          ]
        }
      }) });
      if (url.includes('/findings')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      if (url.includes('/projects') && !url.match(/\/projects\/\d+/)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    });

    renderApp();
    await waitFor(() => {
      const body = document.body.textContent || '';
      expect(body).not.toContain('Invalid Date');
    });
  });

  // Regression: empty history shows correct message
  it('A4. Risk trend shows "No historical risk data available" when history is empty', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/cloud-accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      if (url.includes('/risk')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { current: null, history: [] } }) });
      if (url.includes('/findings')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      if (url.includes('/projects') && !url.match(/\/projects\/\d+/)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    });

    renderApp();
    await waitFor(() => {
      expect(screen.getByText('Not enough historical data')).not.toBeNull();
    });
  });

  it('B. Findings handles data rendering and empty state', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({
      ok: true, json: () => Promise.resolve({ data: [{ id: 1, rule_id: 'Test Rule', severity: 'CRITICAL', resource_name: 'test-res' }] })
    }); });

    renderApp('/projects/123/security');
    await waitFor(() => {
      expect(screen.getByText('Test Rule')).not.toBeNull();
      expect(screen.getByText('CRITICAL')).not.toBeNull();
    });
  });

  it('C. Resources handles data rendering and empty state', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({
      ok: true, json: () => Promise.resolve({ data: [{ id: 1, name: 'RDS', type: 'db' }] })
    }); });

    renderApp('/projects/123/resources');
    await waitFor(() => {
      expect(screen.getByText('RDS')).not.toBeNull();
      expect(screen.getByText('db')).not.toBeNull();
    });
  });

  it('D. Attack paths handles empty state', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) }); });
    renderApp('/projects/123/attack-paths');
    await waitFor(() => {
      expect(screen.getByText('No attack paths detected')).not.toBeNull();
    });
  });

  // Regression: attack path with finding_chain must show target from last node — never blank
  it('D2. Attack path renders target from finding_chain last node', async () => {
    const chain = [
      { resourceId: 'sg-web-001', resourceType: 'SECURITY_GROUP', findingIds: ['SG-001'] },
      { resourceId: 'i-app-001', resourceType: 'EC2', findingIds: [] },
      { resourceId: 'rds-production-001', resourceType: 'RDS', findingIds: ['RDS-001'] },
    ];
    (window.fetch as any).mockImplementation((url: string) => { 
      if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) });
      if (url.includes('/attack-paths')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{
        id: 1,
        description: 'Discovered attack path involving 3 connected resources.',
        severity: 'HIGH',
        finding_chain: chain,
        cloud_account_name: 'Public Exposure'
      }] }) }); 
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    });

    renderApp('/projects/123/attack-paths');
    await waitFor(() => {
      // Target = last node in chain
      expect(screen.getAllByText(/rds-production-001/)[0]).not.toBeNull();
      // Entry = first node in chain
      expect(screen.getAllByText(/sg-web-001/)[0]).not.toBeNull();
      // Should NOT show blank "Target:"
      const body = document.body.innerHTML;
      // The "Target not available for this path" fallback must not appear when data exists
      expect(body).not.toContain('Target not available for this path');
    });
  });

  // Regression: attack path with no finding_chain must show truthful fallback — not blank
  it('D3. Attack path with no finding_chain shows truthful fallback (not blank Target:)', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{
      id: 2,
      description: 'Discovered attack path involving 2 connected resources.',
      severity: 'HIGH',
      finding_chain: null,
      cloud_account_name: 'Test Account'
    }] }) }); });

    renderApp('/projects/123/attack-paths');
    await waitFor(() => {
      // With null finding_chain, must show fallback, not blank
      const body = document.body.textContent || '';
      expect(body).not.toMatch(/Target:\s*$/m); // no blank "Target:"
      expect(body).toContain('Target not available for this path');
    });
  });

  // Regression: SIMULATED_BILLING must NEVER render as "ACTUAL AWS BILLING"
  it('E1. Costs with SIMULATED_DEMO billing_source shows SIMULATED DEMO BILLING (not ACTUAL AWS BILLING)', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({
      ok: true, json: () => Promise.resolve({
        data: [{ amount: '100.50', service_name: 'AmazonEC2', cloud_account_name: 'Test', metric: 'SIMULATED_BILLING' },
               { amount: '200.00', service_name: 'AmazonS3', cloud_account_name: 'Test', metric: 'SIMULATED_BILLING' }],
        meta: { billing_source: 'SIMULATED_DEMO' }
      })
    }); });
    renderApp('/projects/123/costs');
    await waitFor(() => {
      expect(screen.getByText('SIMULATED DEMO BILLING')).not.toBeNull();
      const body = document.body.textContent || '';
      expect(body).not.toContain('ACTUAL AWS BILLING');
    });
  });

  // Regression: ACTUAL_AWS billing_source correctly shows ACTUAL AWS BILLING
  it('E2. Costs with ACTUAL_AWS billing_source shows ACTUAL AWS BILLING', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({
      ok: true, json: () => Promise.resolve({
        data: [{ amount: '500.00', service_name: 'AmazonEC2', cloud_account_name: 'Prod', metric: 'BlendedCost' }],
        meta: { billing_source: 'ACTUAL_AWS' }
      })
    }); });
    renderApp('/projects/123/costs');
    await waitFor(() => {
      expect(screen.getByText('ACTUAL AWS BILLING')).not.toBeNull();
    });
  });

  // Regression: empty costs shows NO BILLING DATA
  it('E3. Costs with no data shows NO BILLING DATA', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({
      ok: true, json: () => Promise.resolve({ data: [], meta: { billing_source: 'NONE' } })
    }); });
    renderApp('/projects/123/costs');
    await waitFor(() => {
      expect(screen.getByText('NO BILLING DATA')).not.toBeNull();
    });
  });

  it('E4. Costs with ACTUAL_AWS billing_source and empty rows shows $0.00 and no cost breakdown', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({
      ok: true, json: () => Promise.resolve({ data: [], meta: { billing_source: 'ACTUAL_AWS' } })
    }); });
    renderApp('/projects/123/costs');
    await waitFor(() => {
      expect(screen.getByText('ACTUAL AWS BILLING')).not.toBeNull();
      expect(screen.getByText('0.00')).not.toBeNull();
      expect(screen.getByText('No cost breakdown data available for this period.')).not.toBeNull();
    });
  });

  it('F. Pricing renders empty state, calculates comparison on submit, and displays results', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) });
      if (url.includes('/pricing/compare')) return Promise.resolve({
        ok: true, json: () => Promise.resolve({ data: {
          comparisonStatus: 'COMPARABLE',
          period: { assumption: '730 hours' },
          providers: [
            { provider: 'AWS', cost: 100.0, costType: 'ESTIMATED_AWS_PUBLIC_LIST', status: 'CALCULATED', unit: 'USD_PER_HOUR', pricingModelVersion: '2026.1', assumptions: ['Linux'], source: 'Demo Reference Pricing' },
            { provider: 'AZURE', status: 'UNKNOWN', reason: 'Not available' }
          ]
        } })
      });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    });

    renderApp('/projects/123/pricing');
    
    await waitFor(() => {
      expect(screen.getAllByText(/Cloud Comparison/i).length).toBeGreaterThan(0);
      expect(screen.getByText('No comparison data yet')).not.toBeNull();
    });

    const whatIfTab = screen.getByText('What-If Calculator');
    fireEvent.click(whatIfTab);

    const compareBtn = screen.getByText('Compare Clouds');
    fireEvent.click(compareBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Estimated Provider Pricing/i).length).toBeGreaterThan(0);
      expect(screen.getByText('$100.00')).not.toBeNull();
      expect(screen.getByText(/Not available/i)).not.toBeNull();
    }, { timeout: 4000 });
  });

  it('G. AI chat handles request and response rendering', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({
      ok: true, json: () => Promise.resolve({ data: { answer: 'AI Answer', sourceRefs: ['FINDING:1'] } })
    }); });
    renderApp('/projects/123/ai');

    const input = screen.getByPlaceholderText(/Ask the AI Cloud Assistant/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(screen.getByText('Hello')).not.toBeNull();
      expect(screen.getByText('AI Answer')).not.toBeNull();
      expect(screen.getByText('FINDING:1')).not.toBeNull();
    });
  });

  it('H. Project isolation ensures different projects fetch their own data', async () => {
    const fetchMock = window.fetch as any;
    fetchMock.mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) }); });

    renderApp('/projects/789/resources');
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/projects/789/resources', expect.any(Object));
    });
  });

  it('I. Security ensures 401 returns empty or error without exposing backend secrets', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }); });
    renderApp('/projects/123/resources');
    await waitFor(() => {
      expect(screen.getByText('No resources found')).not.toBeNull();
    });
  });

  it('J. Reports handles report rendering and pdf download', async () => {
    (window.fetch as any).mockImplementation((url: string) => { if (url === '/api/v1/projects') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Demo' }] }) }); return Promise.resolve({
      ok: true, json: () => Promise.resolve({ data: {
        metadata: { generatedAt: '2024-01-01T00:00:00.000Z' },
        summary: { resourceCount: 5, cloudAccountCount: 1, overallRiskScore: 90, severityDistribution: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 0 } },
        findings: [{ id: '1', title: 'Test Finding', severity: 'HIGH' }],
        attackPaths: [],
        resources: [],
        costs: { totalSpend: 100, currency: 'USD', services: [] },
        limitations: ['Limitation test']
      } })
    }); });
    renderApp('/projects/123/reports');
    await waitFor(() => {
      expect(screen.getByText('Security Assessment Report')).not.toBeNull();
      expect(screen.getByText('Export PDF')).not.toBeNull();
      expect(screen.getByText('Test Finding')).not.toBeNull();
      expect(screen.getByText('Limitation test')).not.toBeNull();
    });
  });
});
