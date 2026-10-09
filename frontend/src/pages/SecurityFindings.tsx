import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ShieldAlert, CheckCircle, Search, Filter } from 'lucide-react';
import { useApi, useProject } from '../lib/api';

export default function SecurityFindings() {
  const { projectId } = useProject();
  const { data: findings, loading } = useApi<any[]>(`/projects/${projectId}/findings`);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <ShieldAlert className="w-8 h-8 animate-pulse text-primary-300 mb-4" />
      <p className="font-medium">Loading findings...</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Security Findings</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Review and manage security risks detected in your environment.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search findings..." className="bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-64 transition-shadow" />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select className="bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none transition-shadow cursor-pointer">
              <option>All Severities</option>
              <option>Critical</option>
              <option>High</option>
            </select>
          </div>
        </div>
      </div>
      
      <Card>
        <CardHeader title="Active Findings" subtitle="Filtered by open status" />
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {findings && findings.length > 0 ? (
              findings.map((finding: any) => (
                <div key={finding.id} className="p-6 hover:bg-slate-50 transition-colors group">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-lg shrink-0 border ${finding.severity === 'CRITICAL' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-slate-900 font-bold text-base group-hover:text-primary-700 transition-colors">{finding.rule_id || 'Security Finding'}</h4>
                        <p className="text-sm font-medium text-slate-600 mt-1.5 leading-relaxed max-w-3xl">{finding.note || 'No description provided.'}</p>
                        <div className="flex flex-wrap gap-2 mt-3 text-xs">
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-semibold border border-slate-200">
                            Resource: <span className="text-slate-900">{finding.resource_name || finding.resource_id || 'Unknown'}</span>
                          </span>
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-semibold border border-slate-200">
                            Account: <span className="text-slate-900">{finding.cloud_account_name || 'Unknown'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <Badge variant={finding.severity === 'CRITICAL' || finding.severity === 'HIGH' ? 'error' : 'warning'}>
                        {finding.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-24 text-center text-slate-500 flex flex-col items-center">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 border border-green-100">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No active findings</h3>
                <p className="text-sm mt-1">Your environment is looking healthy and secure.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
