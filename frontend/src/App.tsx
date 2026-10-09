import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AppShell from "./components/layout/AppShell";
import ProjectRedirect from "./components/ProjectRedirect";

// Existing pages
import Dashboard from "./pages/Dashboard";
import SecurityFindings from "./pages/SecurityFindings";
import AttackPaths from "./pages/AttackPaths";
import Resources from "./pages/Resources";
import Costs from "./pages/Costs";
import Pricing from "./pages/Pricing";
import AIAssistant from "./pages/AIAssistant";
import Reports from "./pages/Reports";
import AdminDashboard from "./pages/AdminDashboard";

// Phase 21 pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import Projects from "./pages/Projects";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root: smart redirect */}
          <Route path="/" element={<ProjectRedirect />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Onboarding wizard */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Project selector */}
          <Route path="/projects" element={<Projects />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />

          {/* Project dashboard (existing) */}
          <Route path="/projects/:projectId" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="security" element={<SecurityFindings />} />
            <Route path="attack-paths" element={<AttackPaths />} />
            <Route path="resources" element={<Resources />} />
            <Route path="costs" element={<Costs />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="ai" element={<AIAssistant />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
