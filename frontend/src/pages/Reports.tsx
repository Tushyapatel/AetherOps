import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchApi, useProject } from '../lib/api';
import { FileText, Download, Shield, Database, AlertCircle, DollarSign } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Reports() {
  usePageTitle('Security Assessment Report | AtherOps');
  const { projectId } = useProject();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi(`/projects/${projectId}/reports/security-assessment`)
      .then((res: any) => {
        setReport(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId]);

  const handleDownloadPdf = () => {
    window.open(`/api/v1/projects/${projectId}/reports/security-assessment/pdf`, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 font-medium">
          {error}
        </div>
      </div>
    );
  }

  if (!report) {
    return <div className="p-8 text-black font-medium">No report data available.</div>;
  }

  return (
    <div className="report-text-black p-4 sm:p-8 max-w-5xl mx-auto space-y-6 text-black">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-black flex items-center">
            <FileText className="w-6 h-6 mr-3 text-primary-600" />
            Security Assessment Report
          </h1>
          <p className="text-black mt-1 font-semibold text-sm">
            Generated: {new Date(report.metadata.generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleDownloadPdf}
          className="flex items-center px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-sm"
        >
          <Download className="w-4 h-4 mr-2 text-white" />
          Export PDF
        </button>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center text-black font-bold text-xs uppercase tracking-wider mb-2">
              <Shield className="w-4 h-4 mr-2 text-primary-600" />
              Overall Risk Score
            </div>
            <div className="text-4xl font-black text-black">
              {report.summary.overallRiskScore !== null ? report.summary.overallRiskScore : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center text-black font-bold text-xs uppercase tracking-wider mb-2">
              <Database className="w-4 h-4 mr-2 text-primary-600" />
              Total Resources
            </div>
            <div className="text-4xl font-black text-black">
              {report.summary.resourceCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center text-black font-bold text-xs uppercase tracking-wider mb-2">
              <AlertCircle className="w-4 h-4 mr-2 text-primary-600" />
              Open Findings
            </div>
            <div className="text-4xl font-black text-black">
              {report.findings.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity Distribution */}
      <Card>
        <CardHeader title="Severity Distribution" titleClassName="text-black" />
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <div className="text-black text-xs font-bold uppercase tracking-wider mb-1">CRITICAL</div>
              <div className="text-2xl text-black font-black">{report.summary.severityDistribution.CRITICAL}</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <div className="text-black text-xs font-bold uppercase tracking-wider mb-1">HIGH</div>
              <div className="text-2xl text-black font-black">{report.summary.severityDistribution.HIGH}</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <div className="text-black text-xs font-bold uppercase tracking-wider mb-1">MEDIUM</div>
              <div className="text-2xl text-black font-black">{report.summary.severityDistribution.MEDIUM}</div>
            </div>
            <div className="bg-sky-50 rounded-xl p-4 border border-sky-200">
              <div className="text-black text-xs font-bold uppercase tracking-wider mb-1">LOW</div>
              <div className="text-2xl text-black font-black">{report.summary.severityDistribution.LOW}</div>
            </div>
            <div className="bg-slate-100 rounded-xl p-4 border border-slate-200">
              <div className="text-black text-xs font-bold uppercase tracking-wider mb-1">INFO</div>
              <div className="text-2xl text-black font-black">{report.summary.severityDistribution.INFO}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Findings & Attack Paths Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Top Security Findings" titleClassName="text-black" />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200">
              {report.findings.length > 0 ? (
                report.findings.slice(0, 5).map((f: any) => (
                  <div key={f.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-black text-sm">{f.title}</h4>
                      <Badge variant={
                        f.severity === 'CRITICAL' ? 'error' :
                        f.severity === 'HIGH' ? 'warning' :
                        f.severity === 'MEDIUM' ? 'warning' :
                        f.severity === 'LOW' ? 'info' : 'default'
                      }>{f.severity}</Badge>
                    </div>
                    <p className="text-xs text-black mt-1 font-semibold">{f.resource_name} ({f.resource_type})</p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-black font-medium text-sm">No findings generated.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Attack Paths" titleClassName="text-black" />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200">
              {report.attackPaths.length > 0 ? (
                report.attackPaths.slice(0, 5).map((ap: any) => (
                  <div key={ap.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <h4 className="font-bold text-black text-sm">{ap.title}</h4>
                    <p className="text-xs text-black mt-1 line-clamp-2 leading-relaxed font-normal">{ap.description}</p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-black font-medium text-sm">No attack paths generated.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environment Summary */}
      <Card>
        <CardHeader title="Environment Summary" titleClassName="text-black" />
        <CardContent>
          <div className="text-black font-medium text-sm leading-relaxed">
            Analyzed <span className="font-bold text-black">{report.summary.resourceCount}</span> resources across <span className="font-bold text-black">{report.summary.cloudAccountCount}</span> cloud accounts.
          </div>
          {report.costs && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center text-black font-bold text-xs uppercase tracking-wider mb-1">
                <DollarSign className="w-4 h-4 mr-1 text-primary-600" />
                {report.costs.billingSource === 'ACTUAL_AWS'
                  ? 'Actual AWS Billing Total'
                  : report.costs.billingSource === 'SIMULATED_DEMO'
                  ? 'Simulated Demo Billing Total'
                  : 'Estimated Billing Total'}
              </div>
              <div className="text-2xl font-black text-black">
                {report.costs.totalSpend.toFixed(2)} {report.costs.currency}
              </div>
              {report.costs.billingSource === 'SIMULATED_DEMO' && (
                <p className="text-xs text-black font-medium mt-1">Simulated demo data — not actual AWS Cost Explorer data</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Report Limitations */}
      {report.limitations.length > 0 && (
        <Card>
          <CardHeader title="Report Limitations" titleClassName="text-black" />
          <CardContent>
            <ul className="list-disc pl-5 space-y-1.5 text-black text-sm">
              {report.limitations.map((limit: string, idx: number) => (
                <li key={idx} className="leading-relaxed text-black font-medium">{limit}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
