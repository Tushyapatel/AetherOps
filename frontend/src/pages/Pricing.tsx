import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Cloud, AlertTriangle, Cpu, HardDrive, Database, Info, Loader2 } from 'lucide-react';
import { fetchApi, useProject } from '../lib/api';

// WorkloadCategory is used implicitly by the API response type mapping

export default function Pricing() {
  const { projectId } = useProject();
  
  const [mode, setMode] = useState<'CURRENT_ACCOUNT' | 'WHAT_IF'>('CURRENT_ACCOUNT');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');

  useEffect(() => {
    if (projectId) {
      fetchApi(`/projects/${projectId}/cloud-accounts`).then((data: any) => {
        const accs = Array.isArray(data) ? data : (data?.data || []);
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccountId(accs[0].id);
      }).catch(console.error);
    }
  }, [projectId]);

  const [region, setRegion] = useState('INDIA');
  
  // Compute states
  const [computeEnabled, setComputeEnabled] = useState(true);
  const [computeCpu, setComputeCpu] = useState<number | ''>(2);
  const [computeMemoryGb, setComputeMemoryGb] = useState<number | ''>(8);
  const [computeHours, setComputeHours] = useState<number | ''>(730);
  const [computeOs, setComputeOs] = useState('Linux');
  
  // Storage state
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [storageGb, setStorageGb] = useState<number | ''>(100);

  // Database state
  const [databaseEnabled, setDatabaseEnabled] = useState(false);
  const [dbCpu, setDbCpu] = useState<number | ''>(2);
  const [dbMemoryGb, setDbMemoryGb] = useState<number | ''>(8);
  const [dbHours, setDbHours] = useState<number | ''>(730);
  
  const [pricingData, setPricingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!computeEnabled && !storageEnabled && !databaseEnabled) {
      return setError('At least one component (Compute, Storage, Database) must be enabled.');
    }

    if (computeEnabled) {
      if (!computeCpu || computeCpu <= 0) return setError('Compute vCPU must be greater than 0');
      if (!computeMemoryGb || computeMemoryGb <= 0) return setError('Compute Memory must be greater than 0');
      if (!computeHours || computeHours <= 0) return setError('Compute hours per month must be greater than 0');
    }
    if (storageEnabled) {
      if (!storageGb || storageGb <= 0) return setError('Storage GB must be greater than 0');
    }
    if (databaseEnabled) {
      if (!dbCpu || dbCpu <= 0) return setError('Database vCPU must be greater than 0');
      if (!dbMemoryGb || dbMemoryGb <= 0) return setError('Database Memory must be greater than 0');
      if (!dbHours || dbHours <= 0) return setError('Database hours per month must be greater than 0');
    }

    setLoading(true);
    setError(null);
    setPricingData(null);

    const payload: any = { region };

    if (computeEnabled) {
      payload.compute = { enabled: true, workload: { cpu: computeCpu, memoryGb: computeMemoryGb, operatingSystem: computeOs, hoursPerMonth: computeHours } };
    }
    if (storageEnabled) {
      payload.storage = { enabled: true, workload: { storageGb: storageGb } };
    }
    if (databaseEnabled) {
      payload.database = { enabled: true, workload: { cpu: dbCpu, memoryGb: dbMemoryGb, hoursPerMonth: dbHours } };
    }

    try {
      const res: any = await fetchApi(`/projects/${projectId}/pricing/compare`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setPricingData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to calculate comparison.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompareAccount = async () => {
    if (!selectedAccountId) return setError('Please select an account');
    setLoading(true);
    setError(null);
    setPricingData(null);
    try {
      const res: any = await fetchApi(`/projects/${projectId}/pricing/account/${selectedAccountId}`);
      setPricingData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to calculate account comparison.');
    } finally {
      setLoading(false);
    }
  };

  const getCostTypeLabel = (type: string) => {
    switch (type) {
      case 'ACTUAL_AWS_BILLING': return 'Actual AWS account billing';
      case 'ESTIMATED_AWS_PUBLIC_LIST': return 'AtherOps modeled AWS workload estimate';
      case 'ESTIMATED_AZURE_RETAIL': return 'Estimated Provider Pricing';
      case 'ESTIMATED_GCP_PUBLIC_LIST': return 'Estimated Provider Pricing';
      case 'SIMULATED_DEMO_BILLING': return 'Simulated demo billing';
      case 'DEMO_REFERENCE_PRICING': return 'Demo reference pricing';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cloud Comparison</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Compare deterministic workload estimates across AWS, Azure, and GCP.</p>
        </div>
      </div>
      
      <div className="flex border-b border-slate-200 mb-6">
        <button
          className={`py-3 px-6 text-sm font-bold transition-colors ${mode === 'CURRENT_ACCOUNT' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          onClick={() => { setMode('CURRENT_ACCOUNT'); setPricingData(null); setError(null); }}
        >
          Current Account Comparison
        </button>
        <button
          className={`py-3 px-6 text-sm font-bold transition-colors ${mode === 'WHAT_IF' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          onClick={() => { setMode('WHAT_IF'); setPricingData(null); setError(null); }}
        >
          What-If Calculator
        </button>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3 text-indigo-900 shadow-sm">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-indigo-500" />
        <div className="text-sm">
          <p className="font-bold text-indigo-800">Estimation Notice</p>
          <p className="mt-1 font-medium text-indigo-700/80">Cloud Comparison provides deterministic estimated provider pricing for analyzed workloads. It is not your actual AWS bill. Actual AWS billing remains available through the Costs/Billing area.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Form */}
        <div className="xl:col-span-4 space-y-6">
          {mode === 'CURRENT_ACCOUNT' ? (
            <Card>
              <CardHeader title="Select Account" subtitle="Choose an AWS account to analyze" />
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cloud Account</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.environment})</option>
                    ))}
                  </select>
                </div>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-lg">
                    {error}
                  </div>
                )}
                <button 
                  onClick={handleCompareAccount}
                  disabled={loading}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Calculating...' : 'Compare Current Account'}
                </button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Workload Requirements" subtitle="Define the resources to estimate" />
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Region</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="INDIA">India</option>
                  <option value="US_EAST">US East</option>
                  <option value="EU_WEST">EU West</option>
                </select>
              </div>

              {/* Compute Component */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={computeEnabled} onChange={e => setComputeEnabled(e.target.checked)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer" />
                  <Cpu className="w-4 h-4 text-primary-500" /> Compute
                </label>
                {computeEnabled && (
                  <div className="pl-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">vCPU</label>
                        <input 
                          type="number" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          value={computeCpu}
                          onChange={(e) => setComputeCpu(e.target.value === '' ? '' : Number(e.target.value))}
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Memory (GB)</label>
                        <input 
                          type="number" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          value={computeMemoryGb}
                          onChange={(e) => setComputeMemoryGb(e.target.value === '' ? '' : Number(e.target.value))}
                          min="1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">OS</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          value={computeOs}
                          onChange={(e) => setComputeOs(e.target.value)}
                        >
                          <option value="Linux">Linux</option>
                          <option value="Windows">Windows</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Hours/Month</label>
                        <input 
                          type="number" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          value={computeHours}
                          onChange={(e) => setComputeHours(e.target.value === '' ? '' : Number(e.target.value))}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Storage Component */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={storageEnabled} onChange={e => setStorageEnabled(e.target.checked)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer" />
                  <HardDrive className="w-4 h-4 text-amber-500" /> Storage
                </label>
                {storageEnabled && (
                  <div className="pl-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Storage (GB)</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        value={storageGb}
                        onChange={(e) => setStorageGb(e.target.value === '' ? '' : Number(e.target.value))}
                        min="1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Database Component */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={databaseEnabled} onChange={e => setDatabaseEnabled(e.target.checked)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer" />
                  <Database className="w-4 h-4 text-emerald-500" /> Database
                </label>
                {databaseEnabled && (
                  <div className="pl-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">vCPU</label>
                        <input 
                          type="number" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          value={dbCpu}
                          onChange={(e) => setDbCpu(e.target.value === '' ? '' : Number(e.target.value))}
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Memory (GB)</label>
                        <input 
                          type="number" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          value={dbMemoryGb}
                          onChange={(e) => setDbMemoryGb(e.target.value === '' ? '' : Number(e.target.value))}
                          min="1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Hours/Month</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        value={dbHours}
                        onChange={(e) => setDbHours(e.target.value === '' ? '' : Number(e.target.value))}
                        min="1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-lg">
                  {error}
                </div>
              )}

              <button 
                onClick={handleCompare}
                disabled={loading}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Calculating comparison...' : 'Compare Clouds'}
              </button>
            </CardContent>
          </Card>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="xl:col-span-8">
          {!pricingData && !loading ? (
            <Card className="min-h-[320px] flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200">
              <Cloud className="w-14 h-14 text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700">No comparison data yet</h3>
              <p className="text-slate-500 mt-2 max-w-md text-sm font-medium">Select an account or configure workload requirements, then run a comparison.</p>
            </Card>
          ) : loading ? (
            <Card className="min-h-[320px] flex flex-col items-center justify-center p-12 text-center">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Calculating comparison...</h3>
              <p className="text-slate-500 mt-2 text-sm font-medium">Fetching deterministic estimates from the pricing engine.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader title="Estimated Monthly Cost" subtitle="AtherOps deterministic workload estimates — not provider invoices" />
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['AWS', 'AZURE', 'GCP'].map(provider => {
                      const info = pricingData.providers?.find((p: any) => p.provider === provider);
                      const providerColors: Record<string, string> = {
                        AWS: 'text-amber-600 bg-amber-50 border-amber-100',
                        AZURE: 'text-sky-600 bg-sky-50 border-sky-100',
                        GCP: 'text-green-600 bg-green-50 border-green-100',
                      };
                      const dotColors: Record<string, string> = {
                        AWS: 'bg-amber-500', AZURE: 'bg-sky-500', GCP: 'bg-green-500',
                      };
                      return (
                        <div key={provider} className="p-5 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-4">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColors[provider]}`} />
                            <h4 className="text-base font-extrabold text-slate-800 tracking-tight">{provider}</h4>
                            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full border ${providerColors[provider]}`}>Estimate</span>
                          </div>
                          
                          {info ? (
                            <div className="space-y-3 flex-1">
                              <Badge variant={info.status === 'CALCULATED' ? 'success' : info.status === 'NOT_COMPARABLE' ? 'error' : 'warning'}>
                                {info.status === 'NOT_COMPARABLE' ? 'NOT COMPARABLE' : info.status}
                              </Badge>
                              
                              <div className="text-3xl font-extrabold font-mono text-slate-900 py-2 break-all">
                                {info.status === 'CALCULATED' ? (
                                  `$${info.cost?.toFixed(2)}`
                                ) : (
                                  <span className="flex items-center gap-2 text-amber-600 text-lg">
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {info.status === 'NOT_COMPARABLE' ? 'NOT COMPARABLE' : 'UNKNOWN'}
                                  </span>
                                )}
                              </div>
                              
                              {info.status === 'CALCULATED' && (
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">USD / month</div>
                              )}

                              {info.reason && (
                                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 p-2.5 rounded-lg font-medium">
                                  {info.reason}
                                </div>
                              )}

                              <div className="text-xs text-slate-400 font-semibold pt-1">
                                {getCostTypeLabel(info.costType)}
                              </div>

                              {pricingData.components && mode === 'WHAT_IF' && (
                                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Component Breakdown</h5>
                                  {pricingData.components.compute && (
                                    <div className="text-sm flex justify-between items-center">
                                      <span className="flex items-center gap-1.5 text-slate-500 font-medium"><Cpu className="w-3 h-3" />Compute</span>
                                      <span className="font-mono font-semibold text-slate-700">
                                        {pricingData.components.compute.providers.find((p: any) => p.provider === provider)?.status === 'CALCULATED' 
                                          ? `$${pricingData.components.compute.providers.find((p: any) => p.provider === provider)?.cost?.toFixed(2)}` 
                                          : <span className="text-amber-500">UNKNOWN</span>}
                                      </span>
                                    </div>
                                  )}
                                  {pricingData.components.storage && (
                                    <div className="text-sm flex justify-between items-center">
                                      <span className="flex items-center gap-1.5 text-slate-500 font-medium"><HardDrive className="w-3 h-3" />Storage</span>
                                      <span className="font-mono font-semibold text-slate-700">
                                        {pricingData.components.storage.providers.find((p: any) => p.provider === provider)?.status === 'CALCULATED' 
                                          ? `$${pricingData.components.storage.providers.find((p: any) => p.provider === provider)?.cost?.toFixed(2)}` 
                                          : <span className="text-amber-500">UNKNOWN</span>}
                                      </span>
                                    </div>
                                  )}
                                  {pricingData.components.database && (
                                    <div className="text-sm flex justify-between items-center">
                                      <span className="flex items-center gap-1.5 text-slate-500 font-medium"><Database className="w-3 h-3" />Database</span>
                                      <span className="font-mono font-semibold text-slate-700">
                                        {pricingData.components.database.providers.find((p: any) => p.provider === provider)?.status === 'CALCULATED' 
                                          ? `$${pricingData.components.database.providers.find((p: any) => p.provider === provider)?.cost?.toFixed(2)}` 
                                          : <span className="text-amber-500">UNKNOWN</span>}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400 font-medium">Provider data missing</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {mode === 'CURRENT_ACCOUNT' && pricingData.accountInfo && (
                    <div className="mt-6 p-5 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-sm font-bold text-slate-700 mb-3 break-all">Derived Workload — {pricingData.accountInfo.accountName}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs uppercase mb-1"><Cpu className="w-3 h-3" />Compute</div>
                          <p className="font-semibold text-slate-800">{pricingData.workloadSummary.ec2Count} instances</p>
                          <p className="text-xs text-slate-500 font-medium">{pricingData.workloadSummary.totalCpu} vCPU · {pricingData.workloadSummary.totalMem} GB RAM</p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs uppercase mb-1"><Database className="w-3 h-3" />Database</div>
                          <p className="font-semibold text-slate-800">{pricingData.workloadSummary.rdsCount} instances</p>
                          <p className="text-xs text-slate-500 font-medium">{pricingData.workloadSummary.totalDbCpu} vCPU · {pricingData.workloadSummary.totalDbMem} GB RAM</p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs uppercase mb-1"><HardDrive className="w-3 h-3" />Storage</div>
                          <p className="font-semibold text-slate-800">{pricingData.workloadSummary.s3Count} buckets</p>
                          <p className="text-xs text-slate-500 font-medium">{pricingData.workloadSummary.totalStorageGb} GB total</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase">Current Account Cost</span>
                        <span className="font-extrabold font-mono text-slate-900 text-lg">${pricingData.billing.currentCost.toFixed(2)}</span>
                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">{pricingData.billing.billingType}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assumptions & Version */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader title="Pricing Assumptions" subtitle="Model inputs used in this comparison" />
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {pricingData.providers?.find((p: any) => p.assumptions && p.assumptions.length > 0)?.assumptions?.map((asm: string, i: number) => (
                        <li key={i} className="flex gap-2 text-slate-700 font-medium">
                          <span className="text-primary-500 mt-0.5">•</span> {asm}
                        </li>
                      )) || <li className="text-slate-400 font-medium">No explicit assumptions provided</li>}
                    </ul>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader title="Pricing Engine" subtitle="AtherOps deterministic pricing source" />
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Model Version</p>
                        <p className="text-lg font-bold text-slate-900">
                          {pricingData.providers?.find((p: any) => p.pricingModelVersion)?.pricingModelVersion || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Source</p>
                        <p className="text-sm font-semibold text-slate-700">Demo Reference Pricing</p>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-indigo-700">These are AtherOps estimates. They are not provider invoices or commitments.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
