import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Activity, ChevronRight, Zap } from 'lucide-react';
import { useApi, useProject } from '../lib/api';
import { Badge } from '../components/ui/Badge';

/**
 * Each attack path has a `finding_chain` (JSONB array).
 * Format: [{ resourceId, resourceType, findingIds[] }, ...]
 * The LAST element is the target of the attack path.
 * The FIRST element is the entry point (initial compromise).
 */
interface ChainNode {
  resourceId: string;
  resourceType: string;
  findingIds: string[];
}

function parseChain(raw: any): ChainNode[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ChainNode[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function getTargetDisplay(chain: ChainNode[]): string | null {
  if (chain.length === 0) return null;
  const last = chain[chain.length - 1];
  if (!last?.resourceId) return null;
  return `${last.resourceId} (${last.resourceType})`;
}

function getEntryDisplay(chain: ChainNode[]): string | null {
  if (chain.length === 0) return null;
  const first = chain[0];
  if (!first?.resourceId) return null;
  return `${first.resourceId} (${first.resourceType})`;
}

export default function AttackPaths() {
  const { projectId } = useProject();
  const { data: paths, loading } = useApi<any[]>(`/projects/${projectId}/attack-paths`);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <Activity className="w-8 h-8 animate-pulse text-primary-300 mb-4" />
      <p className="font-medium">Loading attack paths...</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Attack Paths</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Visualize and remediate exploitable security chains.</p>
        </div>
      </div>

      <Card className="min-h-[500px]">
        <CardHeader title="Attack Path Visualization" subtitle="Nodes represent resources, edges represent relationships" />
        <CardContent className="h-full bg-slate-50/50 p-6">
          {paths && paths.length > 0 ? (
            <div className="space-y-6">
              {paths.map((path: any) => {
                const chain = parseChain(path.finding_chain);
                const target = getTargetDisplay(chain);
                const entry = getEntryDisplay(chain);
                const nodeCount = chain.length;
                const ruleIds = [...new Set(chain.flatMap((n: ChainNode) => n.findingIds || []))].filter(Boolean);

                return (
                  <div key={path.id} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${path.severity === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                          <Zap className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-slate-900 text-lg">
                          {path.description || `Attack path involving ${nodeCount} resources`}
                        </h4>
                      </div>
                      <Badge variant={path.severity === 'CRITICAL' ? 'error' : 'warning'}>
                        {path.severity || 'HIGH'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-slate-50 border border-slate-100 rounded-lg p-4 mb-4">
                      <div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Entry Point</span>
                        <p className="text-slate-900 font-mono text-xs bg-white border border-slate-200 px-2 py-1 rounded inline-block">
                          {entry ?? 'Not available'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Target</span>
                        <p className="text-slate-900 font-mono text-xs bg-white border border-slate-200 px-2 py-1 rounded inline-block">
                          {target ?? 'Target not available for this path'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Triggered Rules</span>
                        <p className="text-slate-700 text-xs font-medium">
                          {ruleIds.length > 0 ? ruleIds.join(', ') : 'None recorded'}
                        </p>
                      </div>
                    </div>

                    {/* Compact chain visualization */}
                    {chain.length > 0 && (
                      <div className="mt-4 flex items-center flex-wrap gap-2 text-xs font-mono">
                        {chain.map((node: ChainNode, idx: number) => (
                          <span key={idx} className="flex items-center gap-2">
                            <span className={`px-2.5 py-1.5 rounded-md border shadow-sm font-semibold ${
                              node.findingIds?.length > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-700'
                            }`}>
                              {node.resourceId}
                            </span>
                            {idx < chain.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300" />}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500">
                      Account: <span className="text-slate-800 bg-slate-100 px-2 py-1 rounded">{path.cloud_account_name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 h-64 space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                <Activity className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No attack paths detected</h3>
              <p className="text-sm">We couldn't find any connected exploitable paths in your environment.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
