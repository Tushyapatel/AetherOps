import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, Database, Activity, DollarSign, Cloud, Bot, LogOut, FileText, FolderOpen, ChevronDown, Bell, Search } from 'lucide-react';
import { useProject, fetchApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { AtherOpsLogo } from '../AtherOpsLogo';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function AppShell() {
  const { projectId, setProjectId } = useProject();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetchApi<any[]>('/projects').then(data => {
      setProjects(data || []);
    }).catch(err => console.error('Failed to load projects', err));
  }, []);

  const navigation = [
    { name: 'Dashboard', href: `/projects/${projectId}`, icon: LayoutDashboard },
    { name: 'Resources', href: `/projects/${projectId}/resources`, icon: Database },
    { name: 'Security Findings', href: `/projects/${projectId}/security`, icon: Shield },
    { name: 'Attack Paths', href: `/projects/${projectId}/attack-paths`, icon: Activity },
    { name: 'Costs & Billing', href: `/projects/${projectId}/costs`, icon: DollarSign },
    { name: 'Cloud Comparison', href: `/projects/${projectId}/pricing`, icon: Cloud },
    { name: 'AI Assistant', href: `/projects/${projectId}/ai`, icon: Bot },
    { name: 'Reports', href: `/projects/${projectId}/reports`, icon: FileText },
  ];

  // Helper to determine active page title
  const activeNavItem = navigation.find(n => n.href === location.pathname) 
    || (location.pathname === '/projects' ? { name: 'All Projects' } : { name: 'Dashboard' });

  usePageTitle(`${activeNavItem.name} | AtherOps`);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Sidebar - Deep Navy */}
      <div className="w-64 bg-navy-900 border-r border-navy-800 flex flex-col shrink-0 shadow-lg z-20">
        <div className="h-16 flex items-center px-6 border-b border-navy-800 shrink-0">
          <AtherOpsLogo size={28} className="mr-2" />
          <span className="font-bold text-xl tracking-tight text-white">AtherOps</span>
        </div>
        
        <div className="flex-1 py-6 overflow-y-auto custom-scrollbar">
          <nav className="space-y-1 px-4">
            <div className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3 px-3">Workspace</div>
            
            <NavLink
              to="/projects"
              end
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20'
                    : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                }`
              }
            >
              <FolderOpen className="w-5 h-5 mr-3 shrink-0" />
              All Projects
            </NavLink>

            {user?.role === 'PLATFORM_ADMIN' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 mt-1 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20'
                      : 'text-amber-400 hover:bg-navy-800 hover:text-amber-300'
                  }`
                }
              >
                <Shield className="w-5 h-5 mr-3 shrink-0" />
                Admin Dashboard
              </NavLink>
            )}
            
            <div className="my-6 border-t border-navy-800 mx-3"></div>
            <div className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3 px-3">Project Menu</div>

            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === `/projects/${projectId}`}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 mb-1 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20'
                      : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3 shrink-0" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-navy-800 bg-navy-900/50 shrink-0">
          <div className="flex items-center px-3 py-2 mb-3">
             <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm shrink-0 uppercase">
                {user?.email?.[0] ?? 'U'}
             </div>
             <div className="ml-3 overflow-hidden">
               <p className="text-sm font-medium text-white truncate">{user?.email ?? 'Loading…'}</p>
               <p className="text-xs text-navy-400 truncate capitalize">{user?.role?.toLowerCase() ?? 'customer'}</p>
             </div>
          </div>
          <button 
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors"
            onClick={async () => {
              try { await fetch('/api/v1/auth/logout', { method: 'POST' }); } catch (e) { console.error('Logout failed', e); }
              navigate('/login', { replace: true });
            }}
          >
            <LogOut className="w-4 h-4 mr-3 shrink-0" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shrink-0 justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center">
             <h1 className="text-lg font-semibold text-slate-800">
                {activeNavItem.name}
             </h1>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 pr-3 hover:border-primary-300 transition-colors">
              <div className="bg-white border border-slate-200 rounded-md p-1.5 shadow-sm shrink-0">
                 <Database className="w-4 h-4 text-primary-500" />
              </div>
              <select 
                value={projectId} 
                onChange={(e) => {
                  setProjectId(e.target.value);
                  navigate(`/projects/${e.target.value}`);
                }}
                className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer appearance-none outline-none ml-2 w-32 truncate"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                {projects.length === 0 && <option value={projectId}>{projectId}</option>}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none shrink-0" />
            </div>

            <div className="flex items-center space-x-4 border-l border-slate-200 pl-6">
               <button className="text-slate-400 hover:text-primary-600 transition-colors">
                 <Search className="w-5 h-5" />
               </button>
               <button className="text-slate-400 hover:text-primary-600 transition-colors relative">
                 <Bell className="w-5 h-5" />
                 <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
               </button>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

