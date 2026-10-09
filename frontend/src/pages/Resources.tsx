import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Database } from 'lucide-react';
import { useApi, useProject } from '../lib/api';

export default function Resources() {
  const { projectId } = useProject();
  const { data: resources, loading } = useApi<any[]>(`/projects/${projectId}/resources`);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <Database className="w-8 h-8 animate-pulse text-primary-300 mb-4" />
      <p className="font-medium">Loading resources...</p>
    </div>
  );
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Resource Inventory</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Explore and manage resources across connected cloud accounts.</p>
        </div>
      </div>
      
      <Card>
        <CardHeader title="All Resources" subtitle="Cloud infrastructure assets" />
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {resources && resources.length > 0 ? (
              resources.map((resource: any) => (
                <div key={resource.id} className="p-5 hover:bg-slate-50 transition-colors group flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200 group-hover:bg-white transition-colors">
                      <Database className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{resource.name || resource.resource_id}</h4>
                      <p className="text-sm font-semibold text-slate-500 mt-0.5">{resource.resource_type || resource.type}</p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-slate-600 flex flex-col sm:items-end gap-1">
                    <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-700">Account: {resource.cloud_account_name}</span>
                    <span className="text-slate-500 text-xs flex items-center gap-1">Region: <span className="font-mono text-slate-700">{resource.region}</span></span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-slate-500">
                <Database className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">No resources found</h3>
                <p className="text-sm mt-1">We couldn't find any resources in the connected accounts.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
