import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DollarSign, Info, RefreshCw, AlertTriangle, FileSpreadsheet, Activity } from 'lucide-react';
import { fetchApi, fetchApiWithMeta, useProject } from '../lib/api';

type BillingSource = 'SIMULATED_DEMO' | 'ACTUAL_AWS' | 'MIXED' | 'NONE' | null;

/** Deterministic billing source label — never renders ACTUAL AWS BILLING for simulated data */
function getBillingLabel(source: BillingSource): { label: string; variant: 'warning' | 'success' | 'info' } {
  switch (source) {
    case 'SIMULATED_DEMO': return { label: 'SIMULATED DEMO BILLING', variant: 'warning' };
    case 'ACTUAL_AWS':    return { label: 'ACTUAL AWS BILLING',     variant: 'success' };
    case 'MIXED':         return { label: 'MIXED: DEMO + ACTUAL',   variant: 'warning' };
    case 'NONE':
    default:              return { label: 'NO BILLING DATA',        variant: 'info' };
  }
}

export default function Costs() {
  const { projectId } = useProject();
  const [costs, setCosts] = useState<any[] | null>(null);
  const [billingSource, setBillingSource] = useState<BillingSource>(null);
  const [loading, setLoading] = useState(true);
  
  const [liveAccount, setLiveAccount] = useState<any | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchCosts = async () => {
    try {
      const { data, meta } = await fetchApiWithMeta<any[]>(`/projects/${projectId}/costs`);
      setCosts(data);
      setBillingSource((meta?.billing_source as BillingSource) ?? null);
    } catch {
      setCosts([]);
      setBillingSource('NONE');
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCosts(),
      fetchApi<any[]>(`/projects/${projectId}/cloud-accounts`).then(accounts => {
        const live = accounts.find(a => a.mode === 'LIVE');
        setLiveAccount(live || null);
      }).catch(() => setLiveAccount(null))
    ]).finally(() => setLoading(false));
  }, [projectId]);

  const handleSyncBilling = async () => {
    if (!liveAccount) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await fetchApi(`/projects/${projectId}/cloud-accounts/${liveAccount.id}/billing`);
      await fetchCosts();
    } catch (err: any) {
      if (err.message?.includes('ce:GetCostAndUsage') || err.message?.includes('AccessDenied')) {
        setSyncError('Access Denied: ce:GetCostAndUsage permission is required in AWS.');
      } else {
        setSyncError(err.message || 'Sync failed.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const totalCost = costs?.reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0) || 0;
  const { label: billingLabel, variant: billingVariant } = getBillingLabel(billingSource);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <Activity className="w-8 h-8 animate-pulse text-primary-300 mb-4" />
      <p className="font-medium">Loading costs...</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Costs & Billing</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Review cloud spending from connected cloud accounts.</p>
        </div>
        {liveAccount && (
          <button
            onClick={handleSyncBilling}
            disabled={syncing}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync AWS Billing'}
          </button>
        )}
      </div>

      {syncError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <h4 className="font-bold">Billing Sync Failed</h4>
            <p className="text-sm font-medium mt-1">{syncError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-3 lg:col-span-1">
          <CardContent className="p-6 text-center flex flex-col items-center justify-center min-h-[220px]">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Current Period Spend</p>
            {costs && billingSource !== 'NONE' ? (
              <div className="flex justify-center items-center my-2">
                <DollarSign className="w-8 h-8 text-green-500 mr-1" />
                <h3 className="text-4xl font-extrabold text-slate-900">
                  {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            ) : (
              <h3 className="text-xl font-bold text-slate-400 py-3">Billing data not available</h3>
            )}
            
            <div className="mt-4">
              <Badge variant={billingVariant}>{billingLabel}</Badge>
            </div>
            
            {billingSource === 'SIMULATED_DEMO' && (
              <div className="mt-4 flex items-start gap-2 text-xs text-amber-700 text-left bg-amber-50 rounded-lg p-3 border border-amber-100">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <span className="font-medium">This project uses simulated demo billing. Connect a real AWS account to see actual Cost Explorer data.</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-1 md:col-span-3 lg:col-span-2">
          <CardHeader title="Cost Breakdown" subtitle="Per-service spending across all accounts" />
          <CardContent className="p-0">
            {costs && costs.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Service</th>
                      <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Account</th>
                      <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {costs.map((c: any, i: number) => (
                      <tr key={`${c.cloud_account_name}-${c.service_name}-${i}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-6 font-medium text-slate-900">{c.service_name}</td>
                        <td className="py-3 px-6 text-slate-500">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-semibold">{c.cloud_account_name}</span>
                        </td>
                        <td className="py-3 px-6 font-mono font-semibold text-slate-700 text-right">
                          ${parseFloat(c.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-500 p-6">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
                {billingSource !== 'NONE' ? (
                  <p className="font-medium text-slate-600">No cost breakdown data available for this period.</p>
                ) : (
                  <p className="font-medium text-slate-600">Billing data not available yet.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
