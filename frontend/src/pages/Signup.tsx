import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Lock, Mail, Eye, EyeOff, CheckCircle, XCircle, ArrowRight, Loader2, Cloud, BarChart3, Bot, Zap, Search, Server, Cpu, Database } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AtherOpsLogo } from '../components/AtherOpsLogo';
import { usePageTitle } from '../hooks/usePageTitle';

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number", test: (pw) => /[0-9]/.test(pw) },
];

export default function Signup() {
  usePageTitle('Sign Up | AtherOps');

  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordRulesMet = PASSWORD_RULES.every((r) => r.test(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passwordRulesMet) {
      setError("Password does not meet the requirements.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error?.message || "Registration failed. Please try again.";
        if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already")) {
          throw new Error("An account with this email already exists.");
        }
        throw new Error(msg);
      }

      await refreshUser();
      navigate("/onboarding", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row font-sans overflow-hidden bg-slate-50">
      
      {/* LEFT SIDE: Visual Brand Experience (~60%) */}
      <div className="relative w-full lg:w-[60%] flex flex-col justify-between overflow-hidden border-r border-slate-200">
        
        {/* Soft atmospheric background matching Landing Page */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[80%] rounded-full bg-blue-200 blur-[120px]" />
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-200 blur-[100px]" />
          <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] rounded-full bg-sky-100 blur-[100px]" />
        </div>
        
        {/* Top Content */}
        <div className="relative z-10 px-6 sm:px-10 xl:px-14 pt-6 xl:pt-8 flex-1 flex flex-col justify-between w-full">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-2 xl:mb-4">
            <AtherOpsLogo size={36} />
            <span className="text-xl xl:text-2xl font-extrabold text-navy-900 tracking-tight">AtherOps</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 xl:gap-8 w-full my-auto py-2">
            <div className="w-full max-w-[320px] xl:max-w-[360px] 2xl:max-w-[400px] shrink-0">
              {/* Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-100 shadow-sm text-primary-700 text-[10px] xl:text-xs font-semibold tracking-wide uppercase mb-3 w-fit">
                <Shield className="w-3.5 h-3.5 text-primary-600" /> AI-POWERED CLOUD SECURITY
              </div>

              {/* Headline */}
              <h1 className="text-3xl xl:text-[36px] 2xl:text-[42px] font-extrabold text-navy-900 tracking-tight leading-[1.15] mb-3">
                Start securing<br/>your <span className="text-primary-600">cloud today.</span>
              </h1>
              
              {/* Description */}
              <p className="text-slate-600 text-xs xl:text-sm mb-4 xl:mb-6 leading-relaxed">
                Create your AtherOps account and connect your AWS environment to discover resources, detect security risks, analyze costs, and get AI-powered insights.
              </p>

              {/* Features */}
              <ul className="space-y-2.5 xl:space-y-3 mb-2">
                {[
                  { icon: Search, text: "Discover and map your AWS resources" },
                  { icon: Shield, text: "Detect misconfigurations and security risks" },
                  { icon: BarChart3, text: "Understand costs and compare across clouds" },
                  { icon: Bot, text: "Get AI-powered insights and recommendations" }
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 xl:gap-3">
                    <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                      <feature.icon className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-primary-500"/>
                    </div>
                    <span className="text-slate-700 font-semibold text-xs xl:text-sm">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hero Visual - Mock Dashboard (Sync with Landing Page) */}
            <div className="hidden lg:block w-[320px] xl:w-[350px] 2xl:w-[420px] shrink-0 relative lg:ml-auto self-center mr-1 xl:mr-3">
              <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200 p-2.5 xl:p-3 overflow-hidden z-10 transition-transform hover:-translate-y-1.5 duration-500">
                {/* Mock Dashboard UI Header */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3 px-2 pt-1.5">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="mx-auto text-[10px] xl:text-xs font-semibold text-slate-400">atherops.com / Setup</div>
                </div>
                
                {/* Mock Dashboard Grid */}
                <div className="grid grid-cols-2 gap-2 xl:gap-2.5 p-1">
                  <div className="bg-slate-50 rounded-xl p-2.5 xl:p-3 border border-slate-100">
                    <div className="text-[9px] xl:text-[10px] uppercase font-bold text-slate-500">Total Resources</div>
                    <div className="text-lg xl:text-xl font-bold text-slate-900 mt-0.5">247</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 xl:p-3 border border-slate-100">
                    <div className="text-[9px] xl:text-[10px] uppercase font-bold text-slate-500">Open Findings</div>
                    <div className="text-lg xl:text-xl font-bold text-red-600 mt-0.5">28</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 xl:p-3 border border-slate-100">
                    <div className="text-[9px] xl:text-[10px] uppercase font-bold text-slate-500">Attack Paths</div>
                    <div className="text-lg xl:text-xl font-bold text-amber-500 mt-0.5">12</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 xl:p-3 border border-slate-100">
                    <div className="text-[9px] xl:text-[10px] uppercase font-bold text-slate-500">Monthly Cost</div>
                    <div className="text-lg xl:text-xl font-bold text-primary-600 mt-0.5">$892</div>
                  </div>
                </div>

                {/* Mock Chart & Paths */}
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-2 xl:gap-2.5 p-1 mt-1">
                  <div className="hidden 2xl:flex bg-slate-50 rounded-xl p-2.5 border border-slate-100 h-28 items-end gap-1.5 justify-between">
                    {[40, 70, 45, 90, 65, 80].map((h, i) => (
                      <div key={i} className="w-full bg-primary-200 rounded-t-md" style={{ height: `${h}%` }}>
                        <div className="w-full bg-primary-500 rounded-t-md" style={{ height: '20%' }} />
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-2 flex flex-col justify-center min-h-[90px]">
                    <div className="flex items-center justify-between text-[10px] xl:text-[11px] font-medium">
                      <span className="flex items-center gap-1.5"><Server className="w-3 h-3 text-slate-400"/> EC2 <ArrowRight className="w-3 h-3"/> S3</span>
                      <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[9px] font-bold">Critical</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] xl:text-[11px] font-medium">
                      <span className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-slate-400"/> Lambda <ArrowRight className="w-3 h-3"/> RDS</span>
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold">High</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] xl:text-[11px] font-medium">
                      <span className="flex items-center gap-1.5"><Database className="w-3 h-3 text-slate-400"/> ECS <ArrowRight className="w-3 h-3"/> IAM</span>
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold">High</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating nodes */}
              <div className="absolute -top-3 -right-2 xl:-top-3.5 xl:-right-2.5 w-10 h-10 xl:w-12 xl:h-12 bg-white rounded-xl shadow-lg flex items-center justify-center border border-slate-100 animate-[bounce_3s_ease-in-out_infinite] z-20">
                 <Cloud className="w-5 h-5 xl:w-6 xl:h-6 text-sky-500" />
              </div>
              <div className="absolute bottom-4 -left-3 xl:-left-4 w-10 h-10 xl:w-12 xl:h-12 bg-white rounded-xl shadow-lg flex items-center justify-center border border-slate-100 animate-[bounce_4s_ease-in-out_infinite_0.5s] z-20">
                 <Bot className="w-5 h-5 xl:w-6 xl:h-6 text-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Trust Strip */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 px-6 sm:px-10 xl:px-14 py-3.5 xl:py-4 bg-white/40 backdrop-blur-md border-t border-white/60">
           <div className="flex items-start gap-2.5">
             <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
               <Lock className="w-3.5 h-3.5 text-primary-600"/>
             </div>
             <div>
               <p className="text-xs xl:text-[13px] font-bold text-navy-900 mb-0.5">Read-only AWS access</p>
               <p className="text-[10px] xl:text-[11px] text-slate-500 font-medium leading-tight">Secure IAM role based connection</p>
             </div>
           </div>
           <div className="flex items-start gap-2.5">
             <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
               <Shield className="w-3.5 h-3.5 text-primary-600"/>
             </div>
             <div>
               <p className="text-xs xl:text-[13px] font-bold text-navy-900 mb-0.5">No long-lived credentials</p>
               <p className="text-[10px] xl:text-[11px] text-slate-500 font-medium leading-tight">We do not store your AWS credentials</p>
             </div>
           </div>
           <div className="flex items-start gap-2.5">
             <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
               <Zap className="w-3.5 h-3.5 text-primary-600"/>
             </div>
             <div>
               <p className="text-xs xl:text-[13px] font-bold text-navy-900 mb-0.5">Setup in minutes</p>
               <p className="text-[10px] xl:text-[11px] text-slate-500 font-medium leading-tight">Connect and start analyzing quickly</p>
             </div>
           </div>
        </div>
      </div>

      {/* RIGHT SIDE: Sign Up Form (~40%) */}
      <div className="relative w-full lg:w-[40%] flex flex-col h-screen overflow-y-auto lg:overflow-hidden bg-white shadow-[-20px_0_40px_rgba(0,0,0,0.03)] z-20">
        {/* Top Right Login Link */}
        <div className="absolute top-4 right-6 xl:top-6 xl:right-8 z-20 flex items-center gap-3">
           <span className="text-xs xl:text-sm font-medium text-slate-500 hidden sm:block">Already have an account?</span>
           <Link to="/login" className="px-4 py-1.5 xl:px-5 xl:py-2 text-xs xl:text-sm font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-full transition-colors flex items-center gap-1">
              Sign In <ArrowRight className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
           </Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex justify-center items-center p-4 sm:p-8 xl:p-12 relative z-10 pt-20 lg:pt-0">
          <div className="w-full max-w-[440px] flex flex-col">
            
            <div className="mb-8">
              <h2 className="text-2xl xl:text-3xl font-extrabold text-navy-900 mb-2 tracking-tight">Create your account</h2>
              <p className="text-slate-500 text-xs xl:text-sm font-medium leading-relaxed">
                Join teams using AtherOps to gain visibility, reduce risk, and optimize cloud costs.
              </p>
            </div>
            
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs xl:text-sm flex items-start gap-2 shadow-sm">
                  <div className="shrink-0 mt-0.5">
                    <XCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="font-medium">{error}</span>
                </div>
              )}
              
              <div>
                <label htmlFor="signup-email" className="block text-xs xl:text-[13px] font-bold text-slate-700 mb-1.5">Email address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 xl:h-5 xl:w-5 text-slate-400" />
                  </div>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-9 xl:pl-11 pr-3 py-2.5 xl:py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-medium transition-colors hover:border-slate-300"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-xs xl:text-[13px] font-bold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 xl:h-5 xl:w-5 text-slate-400" />
                  </div>
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-9 xl:pl-11 pr-10 px-3 py-2.5 xl:py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-medium transition-colors hover:border-slate-300"
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password requirements */}
                <div className="mt-2.5 grid grid-cols-2 gap-y-1.5 gap-x-2">
                  {PASSWORD_RULES.map((rule) => {
                    const met = password.length > 0 && rule.test(password);
                    return (
                      <div key={rule.label} className={`flex items-center gap-1.5 text-[10px] xl:text-[11px] font-bold tracking-wide ${met ? "text-green-600" : "text-slate-400"}`}>
                        {met ? <CheckCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3 opacity-50" />}
                        {rule.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="signup-confirm-password" className="block text-xs xl:text-[13px] font-bold text-slate-700 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 xl:h-5 xl:w-5 text-slate-400" />
                  </div>
                  <input
                    id="signup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`appearance-none block w-full pl-9 xl:pl-11 pr-10 px-3 py-2.5 xl:py-3 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium transition-colors hover:border-slate-300 ${
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? "border-green-500 focus:border-green-500 focus:ring-green-500"
                          : "border-red-400 focus:border-red-400 focus:ring-red-400"
                        : "border-slate-200"
                    }`}
                    placeholder="Repeat your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1.5 text-[11px] font-semibold text-red-500">Passwords do not match.</p>
                )}
              </div>

              <button
                id="signup-submit"
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 xl:py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary-600/20 transition-all duration-200 mt-4 xl:mt-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Trust Message at bottom of card */}
            <div className="mt-8 flex gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl items-start">
              <div className="shrink-0 w-6 h-6 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center mt-0.5">
                <Shield className="w-3 h-3 text-primary-600" />
              </div>
              <p className="text-[10px] xl:text-[11px] text-slate-500 font-medium leading-relaxed">
                Your AWS environment is connected using a secure read-only IAM role. AtherOps does not store your AWS credentials.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
