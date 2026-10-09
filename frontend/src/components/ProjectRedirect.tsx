import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchApi } from "../lib/api";
import Landing from "../pages/Landing";

/**
 * ProjectRedirect — determines where to send the user after "/" is loaded.
 *
 * Routes:
 *   unauthenticated         → render <Landing /> (Marketing Page)
 *   PLATFORM_ADMIN          → /admin
 *   0 projects              → /onboarding   (guides new customer)
 *   1 project               → /projects/:id
 *   multiple projects       → /projects
 */
export default function ProjectRedirect() {
  const navigate = useNavigate();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    fetchApi<any>("/auth/me")
      .then((user) => {
        if (user && user.role === "PLATFORM_ADMIN") {
          navigate("/admin", { replace: true });
          return Promise.reject("REDIRECT_ADMIN");
        }
        return fetchApi<any[]>("/projects");
      })
      .then((projects) => {
        if (!projects || projects.length === 0) {
          // New customer — guide them through onboarding
          navigate("/onboarding", { replace: true });
        } else if (projects.length === 1) {
          navigate(`/projects/${projects[0].id}`, { replace: true });
        } else {
          navigate("/projects", { replace: true });
        }
      })
      .catch((err) => {
        if (err === "REDIRECT_ADMIN") return;
        setShowLanding(true);
      });
  }, [navigate]);

  if (showLanding) {
    return <Landing />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        <p className="text-sm font-medium text-slate-500">Loading...</p>
      </div>
    </div>
  );
}
