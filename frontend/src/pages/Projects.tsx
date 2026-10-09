import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, FolderOpen, Plus, ArrowRight, Cloud, Calendar, Loader2 } from "lucide-react";
import { fetchApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { AtherOpsLogo } from '../components/AtherOpsLogo';
import { usePageTitle } from '../hooks/usePageTitle';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function Projects() {
  usePageTitle('Projects | AtherOps');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApi<Project[]>("/projects")
      .then((data) => {
        setProjects(data || []);
      })
      .catch(() => {
        setError("Failed to load projects. Please refresh.");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "—";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AtherOpsLogo size={28} />
            <span className="font-bold text-lg text-navy-900 tracking-tight">AtherOps</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600">{user?.email}</span>
            {user?.role === 'PLATFORM_ADMIN' && (
              <>
                <div className="h-4 w-px bg-slate-300"></div>
                <Link to="/admin" className="text-sm font-bold text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-1.5"><Shield className="w-4 h-4"/> Admin Dashboard</Link>
              </>
            )}
            <div className="h-4 w-px bg-slate-300"></div>
            <button
              onClick={async () => {
                await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
                navigate("/login", { replace: true });
              }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Your Projects</h1>
            <p className="mt-1.5 text-slate-600 font-medium">Select a project to open its security dashboard</p>
          </div>
          {projects.length > 0 && (
            <Link
              to="/onboarding"
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 focus:ring-offset-slate-50"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-sm flex items-start gap-2 shadow-sm">
            <Shield className="w-5 h-5 text-red-500 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-24 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-8 h-8 text-primary-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No projects yet</h2>
            <p className="text-slate-600 mb-8 max-w-sm mx-auto">
              Create your first project to connect and analyze an AWS environment.
            </p>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-primary-600"
            >
              <Plus className="w-5 h-5" />
              Create Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => (
              <button
                key={project.id}
                id={`project-card-${project.id}`}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group text-left bg-white border border-slate-200 hover:border-primary-300 rounded-xl p-6 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg group-hover:bg-primary-50 group-hover:border-primary-100 transition-colors">
                    <Cloud className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2 font-medium">{project.description}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-auto pt-4 border-t border-slate-100">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Created {formatDate(project.created_at)}</span>
                </div>
              </button>
            ))}

            {/* Add new project card */}
            <Link
              to="/onboarding"
              className="group text-left bg-transparent border-2 border-dashed border-slate-300 hover:border-primary-400 hover:bg-white rounded-xl p-6 transition-all flex flex-col items-center justify-center gap-3 min-h-[200px]"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                <Plus className="w-6 h-6 text-slate-500 group-hover:text-primary-600 transition-colors" />
              </div>
              <span className="text-sm font-bold text-slate-600 group-hover:text-primary-700 transition-colors">
                Connect another AWS account
              </span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
