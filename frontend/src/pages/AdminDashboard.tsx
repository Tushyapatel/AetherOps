import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/Badge';
import {
  Shield, Users, FolderOpen, Cloud, ClipboardList, LogOut, LayoutDashboard,
  CheckCircle, XCircle, ChevronLeft, Activity, Server, Loader2, RefreshCw, Lock, Unlock,
  AlertTriangle, Check, ShieldCheck
} from 'lucide-react';
import { AtherOpsLogo } from '../components/AtherOpsLogo';
import { usePageTitle } from '../hooks/usePageTitle';

type AdminTab = 'overview' | 'customers' | 'projects' | 'accounts' | 'audit';

const NAV_ITEMS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',   label: 'Overview',       icon: LayoutDashboard },
  { id: 'customers',  label: 'Customers',      icon: Users },
  { id: 'projects',   label: 'Projects',       icon: FolderOpen },
  { id: 'accounts',   label: 'Cloud Accounts', icon: Cloud },
  { id: 'audit',      label: 'Audit Logs',     icon: ClipboardList },
];

function getAuditVariant(action: string): 'error' | 'warning' | 'success' | 'default' {
  const a = action?.toUpperCase() || '';
  if (a.includes('BLOCK') || a.includes('DELETE') || a.includes('FAIL') || a.includes('DENY')) return 'error';
  if (a.includes('UNBLOCK') || a.includes('CREATE') || a.includes('CONNECT') || a.includes('LOGIN')) return 'success';
  if (a.includes('UPDATE') || a.includes('PATCH') || a.includes('ADMIN')) return 'warning';
  return 'default';
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const navigate = useNavigate();

  const activePageTitle = NAV_ITEMS.find(n => n.id === activeTab)?.label || 'System Admin';
  usePageTitle(`${activeTab === 'overview' ? 'System Admin' : activePageTitle} | AtherOps`);

  useEffect(() => {
    Promise.all([
      fetchApi('/admin/stats'),
      fetchApi('/admin/customers'),
      fetchApi('/admin/projects'),
      fetchApi('/admin/cloud-accounts'),
      fetchApi('/admin/audit-logs?limit=50')
    ]).then(([statsRes, customersRes, projRes, accRes, auditRes]) => {
      setStats(statsRes);
      setCustomers(customersRes as any[]);
      setProjects(projRes as any[]);
      setAccounts(accRes as any[]);
      setAuditLogs(auditRes as any[]);
      setLoading(false);
      setApiError(null);
    }).catch(err => {
      console.error('Admin API Error:', err);
      if (err.message.includes('401') || err.message.includes('403')) {
        navigate('/login');
      } else {
        setApiError('Unable to load platform data. Try again.');
      }
      setLoading(false);
    });
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } finally {
      navigate('/login');
    }
  };

  const handleToggleStatus = async (customerId: number, currentStatus: string) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus === 'ACTIVE' ? 'block' : 'unblock'} this user?`)) return;
    const newStatus = currentStatus === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    try {
      const updated = await fetchApi<any>(`/admin/customers/${customerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, status: updated.status } : c));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer({ ...selectedCustomer, status: updated.status });
      }
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update status');
    }
  };

  const handleDeleteCustomer = async (customerId: number, email: string) => {
    const confirmation = window.prompt(`DANGER ZONE\n\nThis will permanently delete the customer account for ${email} and ALL associated projects, cloud accounts, and data.\n\nType "REMOVE" to confirm.`);
    if (confirmation !== 'REMOVE') return;
    
    try {
      await fetchApi(`/admin/users/${customerId}`, { method: 'DELETE' });
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setSelectedCustomer(null);
      
      const statsRes = await fetchApi('/admin/stats');
      setStats(statsRes);
    } catch (err: any) {
      console.error('Failed to delete customer', err);
      alert(err.message || 'Failed to delete customer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading Platform Administration...</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-8 font-sans">
        <div className="bg-white border border-red-200 rounded-2xl shadow-sm p-10 text-center max-w-md">
          <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Platform Admin Error</h2>
          <p className="text-slate-500 font-medium mt-2">{apiError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 flex items-center gap-2 mx-auto px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      
      {/* ── LEFT SIDEBAR ───────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-[#f0f4f8] border-r border-slate-200 flex flex-col shrink-0 shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-20">
        
        {/* Logo Area */}
        <div className="p-6 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <AtherOpsLogo size={28} className="mr-1" />
            <span className="font-extrabold text-xl tracking-tight text-navy-900">AtherOps</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100/80 border border-amber-200 rounded-md">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">System Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
          <nav className="space-y-1.5">
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSelectedCustomer(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                      : 'text-slate-600 hover:bg-white hover:text-primary-700 hover:shadow-sm'
                  }`}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Info */}
        <div className="p-4 mt-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-primary-500" />
              <h4 className="text-xs font-bold text-slate-900">Platform Administration</h4>
            </div>
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
              Manage customers, projects, cloud accounts, and platform activity.
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0 uppercase border border-primary-200">
                {user?.email?.[0] ?? 'A'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{user?.email ?? 'admin@atherops.com'}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{user?.role ?? 'System Admin'}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="mt-4 flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 rounded-lg transition-colors border border-transparent hover:border-slate-300"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
        
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shrink-0 justify-between z-10 shadow-sm">
          <div className="flex items-center">
             <h1 className="text-lg font-bold text-slate-800">
                {activePageTitle}
             </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xs">
                  {user?.email?.[0] ?? 'A'}
                </div>
                <span className="text-xs font-bold text-slate-700">{user?.email ?? 'System Admin'}</span>
             </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
          <div className="max-w-7xl mx-auto w-full space-y-8">

            {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <>
                {/* Welcome Banner */}
                <div className="relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                   {/* Background Cloud illustration via CSS */}
                   <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-blue-50 to-transparent z-0 opacity-80 pointer-events-none">
                     <div className="absolute top-4 right-10 w-24 h-24 bg-primary-200 rounded-full blur-3xl opacity-50"></div>
                     <div className="absolute bottom-4 right-20 w-32 h-32 bg-sky-200 rounded-full blur-3xl opacity-50"></div>
                   </div>
                   
                   <div className="relative z-10 p-8">
                      <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Welcome to AtherOps Platform Admin</h2>
                      <p className="text-sm font-medium text-slate-500 max-w-xl mb-8">
                        Manage your SaaS platform, monitor customer activity, and ensure the health and security of the AtherOps ecosystem.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div className="flex items-start gap-3">
                            <div className="mt-0.5 p-1.5 bg-blue-50 border border-blue-100 rounded-lg shrink-0">
                               <Shield className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                               <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Secure by design</h4>
                               <p className="text-xs text-slate-500 mt-1 font-medium">Customer data is isolated and protected</p>
                            </div>
                         </div>
                         <div className="flex items-start gap-3">
                            <div className="mt-0.5 p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg shrink-0">
                               <Activity className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                               <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Real-time insights</h4>
                               <p className="text-xs text-slate-500 mt-1 font-medium">Monitor platform health and usage</p>
                            </div>
                         </div>
                         <div className="flex items-start gap-3">
                            <div className="mt-0.5 p-1.5 bg-sky-50 border border-sky-100 rounded-lg shrink-0">
                               <Server className="w-4 h-4 text-sky-600" />
                            </div>
                            <div>
                               <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Trusted infrastructure</h4>
                               <p className="text-xs text-slate-500 mt-1 font-medium">Built for security and scale</p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Customers', value: stats?.totalCustomers ?? 0, icon: Users, color: 'text-primary-600', bg: 'bg-primary-50 border-primary-100' },
                    { label: 'Active Users',    value: stats?.activeUsers ?? 0,    icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
                    { label: 'Blocked Users',   value: stats?.blockedUsers ?? 0,   icon: XCircle,     color: 'text-red-600',   bg: 'bg-red-50 border-red-100' },
                    { label: 'Total Projects',  value: stats?.totalProjects ?? 0,  icon: FolderOpen,  color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
                    { label: 'Cloud Accounts',  value: stats?.connectedCloudAccounts ?? 0, icon: Cloud,  color: 'text-sky-600',   bg: 'bg-sky-50 border-sky-100' },
                    { label: 'Live Accounts',   value: stats?.liveCloudAccounts ?? 0, icon: Check,  color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-100' },
                    { label: 'Demo Accounts',   value: stats?.demoCloudAccounts ?? 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
                    { label: 'Open Findings',   value: (stats?.openFindings?.CRITICAL || 0) + (stats?.openFindings?.HIGH || 0) + (stats?.openFindings?.MEDIUM || 0), icon: Shield, color: 'text-red-600',  bg: 'bg-red-50 border-red-100' },
                  ].map(s => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border ${s.bg}`}>
                          <s.icon className={`w-5 h-5 ${s.color}`} />
                        </div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</div>
                      </div>
                      <div className="text-3xl font-extrabold text-slate-900">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Platform Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Security Findings Summary */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Security Findings by Severity</h3>
                    <div className="flex items-center justify-around gap-4">
                       <div className="text-center">
                          <div className="w-16 h-16 rounded-full border-4 border-red-500 flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <span className="text-xl font-extrabold text-slate-900">{stats?.openFindings?.CRITICAL ?? 0}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Critical</div>
                       </div>
                       <div className="text-center">
                          <div className="w-16 h-16 rounded-full border-4 border-orange-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <span className="text-xl font-extrabold text-slate-900">{stats?.openFindings?.HIGH ?? 0}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">High</div>
                       </div>
                       <div className="text-center">
                          <div className="w-16 h-16 rounded-full border-4 border-amber-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <span className="text-xl font-extrabold text-slate-900">{stats?.openFindings?.MEDIUM ?? 0}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Medium</div>
                       </div>
                    </div>
                  </div>

                  {/* Cloud Account Modes */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Cloud Account Modes</h3>
                    <div className="flex items-center justify-center gap-12">
                       <div className="flex flex-col items-center">
                          <div className="w-24 h-24 rounded-full border-8 border-green-500 flex items-center justify-center mb-4 shadow-sm relative">
                             <div className="absolute inset-0 rounded-full border border-green-200"></div>
                             <span className="text-2xl font-extrabold text-slate-900">{stats?.liveCloudAccounts ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div> Live Accounts
                          </div>
                       </div>
                       <div className="flex flex-col items-center">
                          <div className="w-24 h-24 rounded-full border-8 border-amber-400 flex items-center justify-center mb-4 shadow-sm relative">
                             <div className="absolute inset-0 rounded-full border border-amber-200"></div>
                             <span className="text-2xl font-extrabold text-slate-900">{stats?.demoCloudAccounts ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="w-2 h-2 rounded-full bg-amber-400"></div> Demo Accounts
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── CUSTOMERS TAB ─────────────────────────────────────────────────── */}
            {activeTab === 'customers' && (
              <div className="space-y-6">
                {selectedCustomer ? (
                  <div className="space-y-6">
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back to Customers
                    </button>

                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
                       <div>
                         <h2 className="text-xl font-extrabold text-slate-900">{selectedCustomer.email}</h2>
                         <div className="flex items-center gap-3 mt-2 text-sm font-medium text-slate-500">
                           <span>Role: <strong className="text-slate-700">{selectedCustomer.role}</strong></span>
                           <span>&middot;</span>
                           <span>Joined: {new Date(selectedCustomer.created_at).toLocaleDateString()}</span>
                           <span>&middot;</span>
                           <Badge variant={selectedCustomer.status === 'ACTIVE' ? 'success' : 'error'}>
                             {selectedCustomer.status}
                           </Badge>
                         </div>
                       </div>
                       <div className="flex items-center gap-3">
                         <button
                           onClick={() => handleToggleStatus(selectedCustomer.id, selectedCustomer.status)}
                           className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border shadow-sm transition-colors ${
                             selectedCustomer.status === 'ACTIVE'
                               ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-red-600'
                               : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-green-600'
                           }`}
                         >
                           {selectedCustomer.status === 'ACTIVE'
                             ? <><Lock className="w-4 h-4" /> Block Customer</>
                             : <><Unlock className="w-4 h-4" /> Unblock Customer</>
                           }
                         </button>
                       </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                         <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Customer Projects</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white border-b border-slate-200">
                            <tr>
                              {['Project Name','Status','Accounts','Resources','Findings'].map(h => (
                                <th key={h} className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {projects.filter(p => p.owner_email === selectedCustomer.email).map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-semibold text-slate-900">{p.name}</td>
                                <td className="px-6 py-4">
                                  <Badge variant="default">{p.status}</Badge>
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-600">{p.cloud_account_count}</td>
                                <td className="px-6 py-4 font-medium text-slate-600">{p.resource_count}</td>
                                <td className="px-6 py-4 font-bold text-red-600">{p.finding_count}</td>
                              </tr>
                            ))}
                            {projects.filter(p => p.owner_email === selectedCustomer.email).length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-medium">
                                  No projects for this customer.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="border border-red-200 bg-white rounded-xl shadow-sm overflow-hidden mt-8">
                      <div className="px-6 py-4 border-b border-red-100 bg-red-50/80">
                        <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider">Danger Zone</h3>
                        <p className="text-xs font-medium text-red-700/80 mt-1">Irreversible administrative actions</p>
                      </div>
                      <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Permanently Remove Customer</h4>
                            <p className="text-xs font-medium text-slate-500 mt-1 max-w-xl leading-relaxed">
                              This action will immediately and irreversibly delete the customer's account, along with all associated projects, cloud accounts, resources, analysis runs, findings, and costs.
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteCustomer(selectedCustomer.id, selectedCustomer.email)}
                            className="mt-4 sm:mt-0 shrink-0 whitespace-nowrap px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          >
                            Remove User
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-extrabold text-slate-900">Customers</h2>
                      <p className="text-sm font-medium text-slate-500 mt-1">Manage AtherOps customer accounts and access.</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              {['Customer','Role','Projects','Accounts','Joined','Status','Actions'].map(h => (
                                <th key={h} className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customers.map((c, i) => (
                              <tr
                                key={i}
                                className="hover:bg-blue-50/30 transition-colors"
                              >
                                <td className="px-6 py-4 font-bold text-slate-900 max-w-[200px] truncate">{c.email}</td>
                                <td className="px-6 py-4 font-medium text-slate-600">
                                   <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">{c.role}</span>
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-600">{c.project_count ?? 0}</td>
                                <td className="px-6 py-4 font-medium text-slate-600">{c.cloud_account_count ?? 0}</td>
                                <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                  <Badge variant={c.status === 'ACTIVE' ? 'success' : 'error'}>
                                    {c.status}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => setSelectedCustomer(c)}
                                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-primary-600 hover:bg-slate-50 transition-colors shadow-sm"
                                    >
                                      View
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {customers.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-6 py-16 text-center">
                                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                     <Users className="w-8 h-8 text-slate-400" />
                                  </div>
                                  <h3 className="text-sm font-bold text-slate-900">No customers yet</h3>
                                  <p className="text-xs text-slate-500 mt-1">Customer accounts will appear here.</p>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PROJECTS TAB ──────────────────────────────────────────────────── */}
            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">Projects</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">View projects across the AtherOps platform.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['Project Name','Owner','Status','Accounts','Resources','Open Findings'].map(h => (
                            <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {projects.map((p, i) => (
                          <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{p.name}</td>
                            <td className="px-6 py-4 font-medium text-slate-600 max-w-[180px] truncate">{p.owner_email}</td>
                            <td className="px-6 py-4">
                              <Badge variant="default">{p.status}</Badge>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-600">{p.cloud_account_count}</td>
                            <td className="px-6 py-4 font-medium text-slate-600">{p.resource_count}</td>
                            <td className="px-6 py-4">
                              <span className={`font-extrabold ${p.finding_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {p.finding_count}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {projects.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-16 text-center">
                              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                 <FolderOpen className="w-8 h-8 text-slate-400" />
                              </div>
                              <h3 className="text-sm font-bold text-slate-900">No projects found</h3>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── CLOUD ACCOUNTS TAB ────────────────────────────────────────────── */}
            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">Cloud Accounts</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Monitor connected AWS environments across customers.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['Account Name','Project','Owner','Mode','Environment','Last Scanned'].map(h => (
                            <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {accounts.map((c, i) => (
                          <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{c.account_name}</td>
                            <td className="px-6 py-4 font-medium text-slate-600">{c.project_name}</td>
                            <td className="px-6 py-4 font-medium text-slate-500 max-w-[160px] truncate">{c.owner_email}</td>
                            <td className="px-6 py-4">
                              <Badge variant={c.mode === 'LIVE' ? 'success' : 'warning'}>
                                {c.mode}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded uppercase tracking-wider">{c.environment}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap text-xs">
                              {c.last_scanned_at ? new Date(c.last_scanned_at).toLocaleString() : (
                                <span className="text-slate-400">Never</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {accounts.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-16 text-center">
                              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                 <Cloud className="w-8 h-8 text-slate-400" />
                              </div>
                              <h3 className="text-sm font-bold text-slate-900">No cloud accounts connected</h3>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── AUDIT LOGS TAB ────────────────────────────────────────────────── */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">Audit Logs</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Review administrative activity across AtherOps.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          {['Time','Actor','Action','Entity','Details'].map(h => (
                            <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.map((log, i) => {
                          const variant = getAuditVariant(log.action);
                          return (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-slate-700 max-w-[180px] truncate font-semibold">
                                {log.email || log.user_id}
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant={variant}>{log.action}</Badge>
                              </td>
                              <td className="px-6 py-4 text-slate-600 font-medium">
                                <span>{log.entity_type}</span>
                                {log.entity_id ? (
                                  <span className="ml-1.5 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">#{log.entity_id}</span>
                                ) : null}
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-medium truncate max-w-[250px]">
                                {log.details ? JSON.stringify(log.details) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                        {auditLogs.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-16 text-center">
                              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                 <ClipboardList className="w-8 h-8 text-slate-400" />
                              </div>
                              <h3 className="text-sm font-bold text-slate-900">No audit activity yet</h3>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
