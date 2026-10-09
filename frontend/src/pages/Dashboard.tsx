import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { useApi, useProject } from '../lib/api';
import { Activity, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

/** Safely format a date string — never renders "Invalid Date" */
function safeFormatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { projectId } = useProject();

  const { data: accounts, loading: acctLoading } = useApi<any[]>(`/projects/${projectId}/cloud-accounts`);
  const { data: riskData, loading: riskLoading } = useApi<any>(`/projects/${projectId}/risk`);
  const { data: findingsData, loading: findingsLoading } = useApi<any[]>(`/projects/${projectId}/findings`);

  const riskScore = riskData?.current;
  const history: any[] = riskData?.history || [];
  const topFindings = findingsData?.slice(0, 5) || [];

  if (acctLoading || riskLoading || findingsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Activity className="w-8 h-8 animate-pulse text-primary-300 mb-4" />
        <p className="font-medium">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Risk Score</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{riskScore?.overall_score ?? riskScore?.security_score ?? riskScore?.securityScore ?? 'N/A'}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="p-3 bg-primary-50 text-primary-600 rounded-xl border border-primary-100 shadow-sm">
              <Database className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Accounts</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{accounts?.length || 0}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Cost Score</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{riskScore?.cost_score ?? riskScore?.costScore ?? 'N/A'}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl border border-green-100 shadow-sm">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Reliability</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{riskScore?.reliability_score ?? riskScore?.reliabilityScore ?? 'N/A'}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="min-h-[350px]">
          <CardHeader title="Risk Trends" subtitle="Historical risk scores over time" />
          <CardContent>
            <div className="flex flex-col justify-center h-56 text-slate-500">
              {history.length > 0 ? (
                <div className="flex items-end justify-between h-full pt-4">
                  {history.slice(-10).map((h: any, i: number) => {
                    const dateStr = h.recorded_at ?? h.calculated_at ?? null;
                    const label = safeFormatDate(dateStr);
                    const barHeight = Math.max(4, Math.min(100, Number(h.security_score) || Number(h.overall_score) || 0));
                    return (
                      <div key={i} className="flex flex-col items-center group">
                        <div
                          className="w-8 bg-primary-100 group-hover:bg-primary-500 rounded-t-md transition-colors"
                          style={{ height: `${barHeight}%` }}
                        />
                        <span className="text-xs font-semibold mt-3 text-slate-400">{label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-medium text-slate-600">Not enough historical data</p>
                  <p className="text-sm mt-1 text-slate-400">Trends will appear after subsequent scans.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[350px] flex flex-col">
          <CardHeader title="Top Security Issues" subtitle="Most relevant active findings" />
          <CardContent className="flex-1 overflow-auto">
            <div className="space-y-3">
              {topFindings.length > 0 ? (
                topFindings.map((finding: any) => (
                  <div key={finding.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-1.5">
                      <h4 className="font-bold text-slate-900">{finding.rule_id || finding.ruleId || 'Security Finding'}</h4>
                      <Badge variant={finding.severity === 'CRITICAL' ? 'error' : 'warning'}>
                        {finding.severity}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-600 truncate">{finding.resource_name || finding.resourceId || 'Unknown Resource'}</p>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-12 flex flex-col items-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mb-3 opacity-80" />
                  <p className="font-bold text-slate-700">No active findings</p>
                  <p className="text-sm mt-1 text-slate-500">Your environment is looking healthy.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
