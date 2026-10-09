import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Check, Copy, AlertCircle, RefreshCw,
  Loader2, CheckCircle, XCircle, Cloud, Lock, Server, Activity,
  ChevronDown, ChevronUp, Database, Cpu, Network, ArrowRight
} from "lucide-react";
import { AtherOpsLogo } from '../components/AtherOpsLogo';
import { usePageTitle } from '../hooks/usePageTitle';

interface OnboardingState {
  step: number;
  projectId: string | null;
  projectName: string;
  cloudAccountId: number | null;
  externalId: string | null;
  servicePrincipalArn: string | null;
  awsAccountId: string | null;
  roleArn: string;
  analysisRunId: number | null;
  verificationResult: VerifyResult | null;
  resourcesScanned: number;
  findingsCreated: number;
}

interface VerifyResult {
  connected: boolean;
  role_verified: boolean;
  identity_verified: boolean;
  trust_policy_verified: boolean;
  error?: string;
}

const IAM_POLICY = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{
    Sid: "AtherOpsReadOnly",
    Effect: "Allow",
    Action: [
      "ec2:DescribeVpcs",
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeInstances",
      "s3:ListAllMyBuckets",
      "s3:GetBucketLocation",
      "iam:ListRoles",
      "rds:DescribeDBInstances",
      "lambda:ListFunctions"
    ],
    Resource: "*"
  }]
}, null, 2);

function generateTrustPolicy(principalArn: string | null, externalId: string | null) {
  if (!principalArn || !externalId) return "";
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: { AWS: principalArn },
      Action: "sts:AssumeRole",
      Condition: {
        StringEquals: {
          "sts:ExternalId": externalId
        }
      }
    }]
  }, null, 2);
}

const STEPS = [
  "Create Project",
  "Connect AWS",
  "IAM Setup",
  "Role ARN",
  "Verify AWS",
  "Discovery",
  "Analysis",
  "Complete"
];

function CopyButton({ text, className="" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors shadow-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 ${className}`}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
      {copied ? "Copied!" : ""}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 shadow-sm mb-4">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm font-medium text-red-700">{message}</p>
    </div>
  );
}

function verificationErrorHint(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("access denied") || e.includes("accessdenied")) return "Verify the trust relationship and that the External ID matches exactly.";
  if (e.includes("mismatch") || e.includes("account id")) return "The Role ARN account ID does not match the configured AWS account. Check the ARN.";
  if (e.includes("trust policy") || e.includes("external id")) return "Your IAM role trust policy must require the External ID condition.";
  return error;
}

export default function Onboarding() {
  usePageTitle('Onboarding | AtherOps');
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState>({
    step: 1, projectId: null, projectName: "", cloudAccountId: null,
    externalId: null, servicePrincipalArn: null, awsAccountId: null, roleArn: "", analysisRunId: null,
    verificationResult: null, resourcesScanned: 0, findingsCreated: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  
  // Forms
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [awsAccountIdInput, setAwsAccountIdInput] = useState("");
  const [awsAccountNameInput, setAwsAccountNameInput] = useState("");
  const [awsRegionInput, setAwsRegionInput] = useState("us-east-1");
  const [awsEnvInput, setAwsEnvInput] = useState("production");
  const [roleArnInput, setRoleArnInput] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);

  const set = useCallback((u: Partial<OnboardingState>) => setState((s) => ({ ...s, ...u })), []);
  const go = (step: number) => { setError(""); set({ step }); };

  const createProject = async () => {
    if (!projectName.trim()) { setError("Project name is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/v1/projects", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: projectName.trim(), description: projectDesc.trim() || null }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to create project.");
      set({ projectId: String(data.data.id), projectName: data.data.name, step: 2 });
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to create project."); }
    finally { setLoading(false); }
  };

  const createAwsConnection = async () => {
    if (!/^\d{12}$/.test(awsAccountIdInput.trim())) { setError("AWS Account ID must be exactly 12 digits."); return; }
    if (!awsAccountNameInput.trim()) { setError("Account name is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/v1/projects/${state.projectId}/cloud-accounts`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ provider: "AWS", account_id: awsAccountIdInput.trim(), account_name: awsAccountNameInput.trim(), region: awsRegionInput.trim(), mode: "LIVE", environment: awsEnvInput || null, role_arn: null }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to connect AWS account.");
      const caId = data.data.id as number;
      const setupRes = await fetch(`/api/v1/projects/${state.projectId}/cloud-accounts/${caId}/setup`, { credentials: "include" });
      const setupData = await setupRes.json().catch(() => ({}));
      set({ cloudAccountId: caId, externalId: setupData?.data?.externalId ?? null, servicePrincipalArn: setupData?.data?.servicePrincipalArn ?? null, awsAccountId: awsAccountIdInput.trim(), step: 3 });
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to connect AWS account."); }
    finally { setLoading(false); }
  };

  const saveRoleArn = async () => {
    if (!roleArnInput.trim()) { setError("Role ARN is required."); return; }
    if (!/^arn:aws(-us-gov|-cn)?:iam::\d{12}:role\/.+$/.test(roleArnInput.trim())) { setError("Invalid ARN format. Expected: arn:aws:iam::123456789012:role/RoleName"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/v1/projects/${state.projectId}/cloud-accounts/${state.cloudAccountId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ role_arn: roleArnInput.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to save Role ARN.");
      set({ roleArn: roleArnInput.trim(), step: 5 });
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to save Role ARN."); }
    finally { setLoading(false); }
  };

  const verifyConnection = async () => {
    setLoading(true); setError(""); set({ verificationResult: null });
    try {
      const res = await fetch(`/api/v1/projects/${state.projectId}/cloud-accounts/${state.cloudAccountId}/connection-test`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Verification request failed.");
      const result = data.data as VerifyResult;
      set({ verificationResult: result });
      if (result.connected && result.trust_policy_verified) {
        setTimeout(() => set({ step: 6 }), 1500);
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Verification failed."); }
    finally { setLoading(false); }
  };

  const runDiscovery = async () => {
    setLoading(true); setError(""); setStatusMsg("Connecting to AWS...");
    try {
      setTimeout(() => setStatusMsg("Discovering resources..."), 1500);
      const res = await fetch(`/api/v1/projects/${state.projectId}/cloud-accounts/${state.cloudAccountId}/discover`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Discovery failed.");
      const result = data.data;
      if (result.status === "CANCELLED") throw new Error("Discovery skipped: DEMO mode is not allowed in real onboarding.");
      set({ analysisRunId: result.analysisRunId, resourcesScanned: result.resourcesScanned, step: 7 });
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Discovery failed."); }
    finally { setLoading(false); setStatusMsg(""); }
  };

  const runAnalysis = async () => {
    setLoading(true); setError(""); setStatusMsg("Evaluating security findings");
    try {
      const evalRes = await fetch(`/api/v1/projects/${state.projectId}/cloud-accounts/${state.cloudAccountId}/analysis-runs/${state.analysisRunId}/evaluate`, { method: "POST", credentials: "include" });
      const evalData = await evalRes.json().catch(() => ({}));
      if (!evalRes.ok) throw new Error(evalData?.error?.message || "Security evaluation failed.");
      const findingsCreated = evalData.findingsCreated ?? 0;
      setStatusMsg("Analyzing attack paths");
      const apRes = await fetch(`/api/v1/projects/${state.projectId}/cloud-accounts/${state.cloudAccountId}/analysis-runs/${state.analysisRunId}/attack-paths/analyze`, { method: "POST", credentials: "include" });
      if (!apRes.ok) { const apData = await apRes.json().catch(() => ({})); throw new Error(apData?.error?.message || "Attack-path analysis failed."); }
      
      setStatusMsg("Generating insights");
      setTimeout(() => {
         set({ findingsCreated, step: 8 });
         setLoading(false);
         setStatusMsg("");
      }, 1000);
    } catch (e: unknown) { 
      setError(e instanceof Error ? e.message : "Analysis failed."); 
      setLoading(false); 
      setStatusMsg("");
    }
  };

  // Helper to trigger API on load for steps 5, 6, 7 if desired
  // But we let user click buttons as per reference for better control, except maybe Verify
  useEffect(() => {
    if (state.step === 5 && !state.verificationResult && !loading && !error) {
      verifyConnection();
    }
    if (state.step === 6 && !loading && !error && state.resourcesScanned === 0) {
      runDiscovery();
    }
    if (state.step === 7 && !loading && !error) {
      runAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR (Progress) */}
      <div className="hidden lg:flex flex-col w-[280px] xl:w-[320px] bg-slate-50/50 border-r border-slate-200 shrink-0 h-screen overflow-y-auto z-10 relative">
        <div className="p-8">
          <div className="flex items-center gap-2 mb-12">
            <AtherOpsLogo size={32} />
            <span className="text-xl font-extrabold text-navy-900 tracking-tight">AtherOps</span>
          </div>

          <nav aria-label="Progress">
            <ol className="space-y-6">
              {STEPS.map((label, idx) => {
                const stepNum = idx + 1;
                const isCompleted = stepNum < state.step;
                const isCurrent = stepNum === state.step;
                
                return (
                  <li key={label} className="relative flex items-center gap-4">
                    {/* Vertical Line Connector */}
                    {idx !== STEPS.length - 1 && (
                      <div className={`absolute top-8 left-3.5 -bottom-6 w-px ${isCompleted ? 'bg-green-500' : 'bg-slate-200'}`} />
                    )}
                    
                    {/* Circle */}
                    <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors
                      ${isCompleted ? 'bg-green-500 text-white shadow-sm' 
                        : isCurrent ? 'bg-primary-600 text-white shadow-md ring-4 ring-primary-50' 
                        : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                      {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                    </div>
                    
                    {/* Label */}
                    <span className={`text-sm font-semibold transition-colors
                      ${isCompleted ? 'text-slate-900' 
                        : isCurrent ? 'text-primary-700' 
                        : 'text-slate-400'}`}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {/* Security / Trust Panel */}
        <div className="mt-auto p-6 m-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex gap-3 items-start">
            <div className="shrink-0 w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
               <Shield className="w-3.5 h-3.5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-navy-900 mb-1">Your data is secure</p>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                AtherOps uses read-only access and does not modify your infrastructure.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT CONTENT (Main Area) */}
      <div className="flex-1 h-screen overflow-y-auto bg-gradient-to-br from-white to-slate-50/80 relative">
        {/* Abstract background elements */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-40">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100 blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-sky-100 blur-[100px]" />
        </div>

        {/* Mobile Header (Only visible on small screens) */}
        <div className="lg:hidden p-4 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between">
           <div className="flex items-center gap-2">
            <div className="bg-primary-600 p-1.5 rounded-lg">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-navy-900">AtherOps</span>
          </div>
          <div className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
            Step {state.step} of 8
          </div>
        </div>

        <div className="relative z-10 flex justify-center items-start min-h-full p-4 sm:p-8 lg:p-12 xl:p-20">
          <div className="w-full max-w-[640px]">
             
             {/* Step Header */}
             <div className="mb-6 lg:mb-8">
               <span className="hidden lg:inline-block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Step {state.step} of 8</span>
               
               {state.step === 1 && (
                 <>
                   <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2">Create your first project</h1>
                   <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">Projects keep your cloud environment, security analysis, costs, and insights organized in one workspace.</p>
                 </>
               )}
               {state.step === 2 && (
                 <>
                   <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2 flex items-center gap-3">Connect your AWS account <span className="font-black text-[28px] text-[#FF9900] -mt-1 tracking-tighter">aws</span></h1>
                   <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">AtherOps uses a secure read-only IAM role to discover and analyze your AWS environment.</p>
                 </>
               )}
               {state.step === 3 && (
                 <>
                   <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2">Set up your AtherOps IAM role</h1>
                   <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">Create a read-only IAM role in your AWS account using the configuration below.</p>
                 </>
               )}
               {state.step === 4 && (
                 <>
                   <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2">Enter your AtherOps IAM Role ARN</h1>
                   <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">After creating the IAM role in your AWS account, paste the Role ARN here.</p>
                 </>
               )}
               {state.step === 5 && (
                 <>
                   <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2">Verify your AWS connection</h1>
                   <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">Checking that AtherOps can securely access your AWS account.</p>
                 </>
               )}
               {state.step === 6 && (
                 <>
                   <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2">Discovering your AWS environment</h1>
                   <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">AtherOps is mapping the resources already present in your AWS account.</p>
                 </>
               )}
               {state.step === 7 && (
                 <>
                   <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2">Analyzing your cloud environment</h1>
                   <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">AtherOps is evaluating your environment for security risks, attack paths, and cost intelligence.</p>
                 </>
               )}
               {state.step === 8 && (
                 <>
                   <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2">Your AtherOps workspace is ready</h1>
                   <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">Your AWS environment has been successfully connected and analyzed.</p>
                 </>
               )}
             </div>

             {/* Dynamic Card Content */}
             <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 sm:p-10 mb-8">
               
               {/* STEP 1: CREATE PROJECT */}
               {state.step === 1 && (
                 <div className="space-y-6">
                   <div>
                     <label htmlFor="ob-project-name" className="block text-sm font-bold text-slate-700 mb-2">Project name</label>
                     <input id="ob-project-name" type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. My AWS Project" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-sm font-medium transition-colors hover:border-slate-300" />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">Description (Optional)</label>
                     <textarea rows={3} value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} placeholder="e.g. Production environment for my team" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-sm resize-none font-medium transition-colors hover:border-slate-300" />
                     <div className="text-right text-xs text-slate-400 mt-1.5 font-medium">{projectDesc.length}/200</div>
                   </div>
                   
                   {error && <ErrorBox message={error} />}

                   <button onClick={createProject} disabled={loading} className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 disabled:opacity-50 transition-all shadow-md shadow-primary-600/20 mt-4">
                     {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Project"}
                     {!loading && <ArrowRight className="w-4 h-4" />}
                   </button>

                   {/* Cloud Illustration */}
                   <div className="mt-10 relative h-32 flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-sky-50/50 to-white">
                      <div className="absolute w-24 h-24 bg-blue-400 rounded-full blur-[40px] opacity-20"></div>
                      <Cloud className="w-20 h-20 text-primary-200 absolute -bottom-4" />
                      <div className="relative z-10 w-16 h-16 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center">
                        <span className="text-3xl font-black text-primary-600">A</span>
                      </div>
                      <div className="absolute right-10 top-8 w-12 h-12 bg-white rounded-xl shadow-md border border-slate-100 flex items-center justify-center rotate-6">
                        <Database className="w-6 h-6 text-slate-300" />
                      </div>
                      <div className="absolute left-10 top-12 w-10 h-10 bg-white rounded-xl shadow-md border border-slate-100 flex items-center justify-center -rotate-6">
                        <Shield className="w-5 h-5 text-sky-300" />
                      </div>
                   </div>
                 </div>
               )}

               {/* STEP 2: CONNECT AWS */}
               {state.step === 2 && (
                 <div className="space-y-6">
                   <div>
                     <label htmlFor="awsAccountId" className="block text-sm font-bold text-slate-700 mb-2">AWS Account ID</label>
                     <input id="awsAccountId" type="text" maxLength={12} value={awsAccountIdInput} onChange={(e) => setAwsAccountIdInput(e.target.value.replace(/\D/g, ""))} placeholder="123456789012" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-sm font-mono transition-colors hover:border-slate-300" />
                   </div>
                   <div>
                     <label htmlFor="accountNickname" className="block text-sm font-bold text-slate-700 mb-2">Account nickname</label>
                     <input id="accountNickname" type="text" value={awsAccountNameInput} onChange={(e) => setAwsAccountNameInput(e.target.value)} placeholder="e.g. Production, Development" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-sm transition-colors font-medium hover:border-slate-300" />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">Region</label>
                     <select value={awsRegionInput} onChange={(e) => setAwsRegionInput(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-sm font-medium transition-colors hover:border-slate-300">
                       {["us-east-1","us-east-2","us-west-1","us-west-2","eu-west-1","eu-west-2","eu-central-1","ap-south-1","ap-southeast-1","ap-southeast-2","ap-northeast-1","ca-central-1","sa-east-1"].map((r) => <option key={r} value={r}>{r}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">Environment</label>
                     <select value={awsEnvInput} onChange={(e) => setAwsEnvInput(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-sm font-medium transition-colors hover:border-slate-300">
                       <option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option><option value="sandbox">Sandbox</option>
                     </select>
                   </div>
                   
                   <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3 mt-2">
                     <AlertCircle className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                     <p className="text-xs font-medium text-sky-900 leading-relaxed">
                       AtherOps only needs read-only access to discover and analyze your resources.
                     </p>
                   </div>

                   {error && <ErrorBox message={error} />}

                   <button onClick={createAwsConnection} disabled={loading} className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 disabled:opacity-50 transition-all shadow-md shadow-primary-600/20 mt-4">
                     {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
                     {!loading && <ArrowRight className="w-4 h-4" />}
                   </button>
                 </div>
               )}

               {/* STEP 3: IAM SETUP */}
               {state.step === 3 && (
                 <div className="space-y-6">
                   {!state.servicePrincipalArn ? (
                     <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6 shadow-sm">
                       <div className="flex items-start gap-3">
                         <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                         <div className="text-sm text-amber-900 font-medium">
                           <strong>Trust principal configuration:</strong> The AtherOps service AWS principal ARN is determined by your deployment environment. Contact your AtherOps administrator to obtain the correct principal ARN before creating the role.
                           <br />
                           <em className="text-amber-700 font-bold mt-2 block">BLOCKER: AtherOps runtime AWS principal is not determinable.</em>
                         </div>
                       </div>
                     </div>
                   ) : null}

                   {/* Service Principal */}
                   <div>
                     <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">AtherOps Service Principal</label>
                     <div className="relative">
                       <span className="sr-only">{state.servicePrincipalArn}</span>
                       <input type="text" readOnly value={state.servicePrincipalArn ?? "Unavailable"} className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 shadow-sm text-sm font-mono font-medium focus:outline-none" />
                       <div className="absolute right-2 top-2">
                         {state.servicePrincipalArn && <CopyButton text={state.servicePrincipalArn} />}
                       </div>
                     </div>
                   </div>

                   {/* External ID */}
                   <div>
                     <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">External ID</label>
                     <div id="ob-external-id" className="relative">
                       <span className="sr-only">{state.externalId}</span>
                       <input type="text" readOnly value={state.externalId ?? "Unavailable"} className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 shadow-sm text-sm font-mono font-medium focus:outline-none" />
                       <div className="absolute right-2 top-2">
                         {state.externalId && <CopyButton text={state.externalId} />}
                       </div>
                     </div>
                   </div>

                   {/* Trust Policy Code Block */}
                   <div>
                     <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">IAM Role Trust Policy</label>
                     {state.servicePrincipalArn && state.externalId ? (
                       <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-inner border border-slate-800">
                          <div className="absolute top-2 right-2">
                            <CopyButton text={generateTrustPolicy(state.servicePrincipalArn, state.externalId)} className="!bg-slate-800 !border-slate-700 !text-slate-300 hover:!bg-slate-700" />
                          </div>
                          <pre className="p-4 text-xs font-mono text-[#a5b4fc] overflow-x-auto leading-relaxed max-h-60">
                            {generateTrustPolicy(state.servicePrincipalArn, state.externalId)}
                          </pre>
                       </div>
                     ) : (
                       <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm font-medium text-center">
                         Policy cannot be generated until a valid Service Principal and External ID are available.
                       </div>
                     )}
                   </div>

                   {/* Collapsible Permissions */}
                   <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 transition-all">
                     <button onClick={() => setPolicyOpen(!policyOpen)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                       <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400" /> Read-Only Policy Permissions (View Details)</span>
                       {policyOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                     </button>
                     {policyOpen && (
                       <div className="p-4 border-t border-slate-200 bg-white">
                         <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-inner">
                            <div className="absolute top-2 right-2">
                              <CopyButton text={IAM_POLICY} className="!bg-slate-800 !border-slate-700 !text-slate-300 hover:!bg-slate-700" />
                            </div>
                            <pre className="p-4 text-xs font-mono text-[#a5b4fc] overflow-x-auto leading-relaxed max-h-48">
                              {IAM_POLICY}
                            </pre>
                         </div>
                       </div>
                     )}
                   </div>

                   {error && <ErrorBox message={error} />}

                   <button onClick={() => go(4)} className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 transition-all shadow-md shadow-primary-600/20 mt-4">
                     I have created the role <ArrowRight className="w-4 h-4" />
                   </button>
                 </div>
               )}

               {/* STEP 4: ROLE ARN */}
               {state.step === 4 && (
                 <div className="space-y-6">
                   <div>
                     <label htmlFor="roleArn" className="block text-sm font-bold text-slate-700 mb-2">AWS IAM Role ARN</label>
                     <input id="roleArn" type="text" value={roleArnInput} onChange={(e) => setRoleArnInput(e.target.value.trim())} placeholder="" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-sm font-mono transition-colors hover:border-slate-300" />
                   </div>
                   
                   <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3">
                     <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                       <span className="text-primary-600 font-bold text-[10px]">i</span>
                     </div>
                     <div>
                       <p className="text-xs font-medium text-slate-600 leading-relaxed">Example format:</p>
                       <p className="text-xs font-mono font-bold text-sky-900 mt-0.5 break-all">arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME</p>
                     </div>
                   </div>

                   {/* Illustration */}
                   <div className="mt-8 relative h-32 flex items-center justify-center">
                      <div className="absolute w-32 h-32 bg-sky-100 rounded-full blur-[40px] opacity-40"></div>
                      <div className="relative z-10 w-48 h-20 bg-white rounded-xl shadow-lg border border-slate-100 flex flex-col justify-center px-4">
                         <div className="flex items-center gap-1 mb-2">
                           <div className="w-2 h-2 rounded-full bg-red-400"></div>
                           <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                           <div className="w-2 h-2 rounded-full bg-green-400"></div>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="bg-red-50 p-1.5 rounded-md"><Lock className="w-4 h-4 text-red-500"/></div>
                           <span className="font-bold text-sm text-slate-700">AWS IAM Role</span>
                         </div>
                      </div>
                      <div className="absolute right-8 bottom-4 w-10 h-10 bg-white rounded-lg shadow-md border border-slate-100 flex items-center justify-center z-20">
                        <Copy className="w-4 h-4 text-primary-500" />
                      </div>
                   </div>

                   {error && <ErrorBox message={error} />}

                   <button onClick={saveRoleArn} disabled={loading} className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 disabled:opacity-50 transition-all shadow-md shadow-primary-600/20 mt-4">
                     {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save and Verify"}
                     {!loading && <ArrowRight className="w-4 h-4" />}
                   </button>
                 </div>
               )}

               {/* STEP 5: VERIFY AWS */}
               {state.step === 5 && (
                 <div className="space-y-6">
                   <div className="space-y-4 mb-8">
                     <div className="flex items-center gap-3">
                       {loading ? <Loader2 className="w-5 h-5 text-primary-500 animate-spin" /> : state.verificationResult?.role_verified || state.verificationResult?.connected ? <CheckCircle className="w-5 h-5 text-green-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                       <span className={`text-sm font-bold ${state.verificationResult?.role_verified || state.verificationResult?.connected ? 'text-slate-900' : 'text-slate-500'}`}>Validating Role ARN</span>
                     </div>
                     <div className="flex items-center gap-3">
                       {loading ? <Loader2 className="w-5 h-5 text-slate-300 animate-spin" /> : state.verificationResult?.role_verified || state.verificationResult?.connected ? <CheckCircle className="w-5 h-5 text-green-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                       <span className={`text-sm font-bold ${state.verificationResult?.role_verified || state.verificationResult?.connected ? 'text-slate-900' : 'text-slate-500'}`}>Assuming IAM role</span>
                     </div>
                     <div className="flex items-center gap-3">
                       {loading ? <Loader2 className="w-5 h-5 text-slate-300 animate-spin" /> : state.verificationResult?.identity_verified || state.verificationResult?.connected ? <CheckCircle className="w-5 h-5 text-green-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                       <span className={`text-sm font-bold ${state.verificationResult?.identity_verified || state.verificationResult?.connected ? 'text-slate-900' : 'text-slate-500'}`}>Verifying AWS account</span>
                     </div>
                     <div className="flex items-center gap-3">
                       {loading ? <Loader2 className="w-5 h-5 text-slate-300 animate-spin" /> : state.verificationResult?.trust_policy_verified || state.verificationResult?.connected ? <CheckCircle className="w-5 h-5 text-green-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                       <span className={`text-sm font-bold ${state.verificationResult?.trust_policy_verified || state.verificationResult?.connected ? 'text-slate-900' : 'text-slate-500'}`}>Checking permissions</span>
                     </div>
                   </div>

                   {/* Illustration Area */}
                   <div className="relative h-40 flex items-center justify-center bg-gradient-to-b from-sky-50/30 to-white rounded-xl mb-4">
                     <Cloud className={`w-32 h-32 ${state.verificationResult?.connected ? 'text-green-100' : 'text-slate-100'} absolute top-4`} />
                     <div className="relative z-10 w-24 h-12 bg-white rounded-xl shadow-md border border-slate-100 flex items-center justify-center">
                       <span className="font-black text-xl text-slate-800 tracking-tighter">aws</span>
                     </div>
                     {state.verificationResult?.connected && (
                       <div className="absolute right-1/4 top-1/4 w-8 h-8 bg-green-500 rounded-full border-2 border-white flex items-center justify-center z-20 shadow-sm animate-in zoom-in">
                         <Check className="w-4 h-4 text-white" />
                       </div>
                     )}
                   </div>

                   {state.verificationResult?.connected ? (
                      <p className="text-sm font-medium text-slate-500 text-center leading-relaxed">
                        This may take a few moments. We are securely verifying your AWS connection using temporary credentials.
                      </p>
                   ) : error || state.verificationResult?.error ? (
                     <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                       <div className="flex gap-3">
                         <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                         <div>
                           <p className="text-sm font-bold text-red-900 mb-1">Verification failed</p>
                           <p className="text-xs font-medium text-red-700">{error || verificationErrorHint(state.verificationResult?.error || "")}</p>
                         </div>
                       </div>
                     </div>
                   ) : null}

                   {(error || state.verificationResult?.error) && (
                     <button onClick={() => { setError(""); verifyConnection(); }} disabled={loading} className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 disabled:opacity-50 transition-all shadow-sm">
                       {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                       Retry Connection
                     </button>
                   )}
                 </div>
               )}

               {/* STEP 6: DISCOVERY */}
               {state.step === 6 && (
                 <div className="space-y-6">
                   <div className="text-center mb-8">
                     <p className="text-sm font-bold text-slate-900 mb-1">Discovering resources...</p>
                     <p className="text-xs text-slate-500 font-medium">This may take a few minutes depending on the size of your environment.</p>
                   </div>

                   <div className="space-y-3">
                     {[
                       { name: "EC2 Instances", icon: Server, color: "text-orange-500", bg: "bg-orange-50" },
                       { name: "S3 Buckets", icon: Database, color: "text-green-500", bg: "bg-green-50" },
                       { name: "RDS Databases", icon: Database, color: "text-blue-500", bg: "bg-blue-50" },
                       { name: "IAM Roles", icon: Lock, color: "text-red-500", bg: "bg-red-50" },
                       { name: "Lambda Functions", icon: Cpu, color: "text-amber-500", bg: "bg-amber-50" },
                       { name: "VPCs", icon: Network, color: "text-purple-500", bg: "bg-purple-50" },
                       { name: "Security Groups", icon: Shield, color: "text-amber-500", bg: "bg-amber-50" }
                     ].map((res, i) => (
                       <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                         <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${res.bg}`}>
                             <res.icon className={`w-4 h-4 ${res.color}`} />
                           </div>
                           <span className="text-sm font-bold text-slate-700">{res.name}</span>
                         </div>
                         <span className="text-xs font-semibold text-slate-400">
                           {loading ? "Scanning..." : "Scanned"}
                         </span>
                       </div>
                     ))}
                   </div>

                   {error && <ErrorBox message={error} />}

                   <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3 mt-6">
                     <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                       <Shield className="w-3.5 h-3.5 text-primary-600" />
                     </div>
                     <p className="text-xs font-medium text-sky-900 leading-relaxed">
                       No infrastructure is being created or modified during discovery. AtherOps only reads your resources.
                     </p>
                   </div>
                 </div>
               )}

               {/* STEP 7: ANALYSIS */}
               {state.step === 7 && (
                 <div className="space-y-6">
                   {/* Illustration Area */}
                   <div className="relative h-40 flex items-center justify-center bg-slate-50 rounded-xl mb-8 overflow-hidden">
                     <div className="absolute w-full h-full opacity-50 flex items-center justify-center gap-4">
                        <div className="w-32 h-2 bg-slate-200 rounded-full absolute top-10 blur-sm"></div>
                        <div className="w-40 h-2 bg-slate-200 rounded-full absolute bottom-10 blur-sm"></div>
                     </div>
                     <div className="relative z-10 w-20 h-24 bg-white rounded-xl shadow-md border border-slate-100 flex flex-col gap-2 p-3">
                       <div className="w-full h-2 bg-slate-100 rounded"></div>
                       <div className="w-3/4 h-2 bg-slate-100 rounded"></div>
                       <div className="w-full h-2 bg-slate-100 rounded mt-2"></div>
                       <div className="w-1/2 h-2 bg-slate-100 rounded"></div>
                     </div>
                     <div className="absolute z-20 w-16 h-16 bg-primary-600 rounded-full opacity-20 animate-ping"></div>
                     <div className="absolute z-30 w-12 h-12 bg-white rounded-full shadow-lg border border-slate-100 flex items-center justify-center -mr-16 mt-8">
                       <Activity className="w-6 h-6 text-primary-600" />
                     </div>
                     <div className="absolute z-30 w-10 h-10 bg-white rounded-full shadow-md border border-slate-100 flex items-center justify-center ml-24 -mt-12">
                       <AlertCircle className="w-5 h-5 text-amber-500" />
                     </div>
                   </div>

                   <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         {loading && statusMsg === "Evaluating security findings" ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin" /> : (!loading || statusMsg !== "Evaluating security findings") && statusMsg !== "" ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                         <span className="text-sm font-bold text-slate-700">Evaluating security findings</span>
                       </div>
                       <span className="text-xs font-semibold text-slate-400">
                         {loading && statusMsg === "Evaluating security findings" ? "In progress" : (!loading || statusMsg !== "Evaluating security findings") && statusMsg !== "" ? "Done" : "Pending"}
                       </span>
                     </div>
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         {loading && statusMsg === "Analyzing attack paths" ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin" /> : statusMsg === "Generating insights" ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                         <span className="text-sm font-bold text-slate-700">Analyzing attack paths</span>
                       </div>
                       <span className="text-xs font-semibold text-slate-400">
                         {loading && statusMsg === "Analyzing attack paths" ? "In progress" : statusMsg === "Generating insights" ? "Done" : "Pending"}
                       </span>
                     </div>
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         {loading && statusMsg === "Generating insights" ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin" /> : !loading && statusMsg === "Done" ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                         <span className="text-sm font-bold text-slate-700">Processing cost intelligence</span>
                       </div>
                       <span className="text-xs font-semibold text-slate-400">
                         {loading && statusMsg === "Generating insights" ? "In progress" : !loading && statusMsg === "Done" ? "Done" : "Pending"}
                       </span>
                     </div>
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         {loading && statusMsg === "Generating insights" ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin" /> : !loading && statusMsg === "Done" ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                         <span className="text-sm font-bold text-slate-700">Generating insights</span>
                       </div>
                       <span className="text-xs font-semibold text-slate-400">
                         {loading && statusMsg === "Generating insights" ? "In progress" : !loading && statusMsg === "Done" ? "Done" : "Pending"}
                       </span>
                     </div>
                   </div>

                   {error && <ErrorBox message={error} />}

                   <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3 mt-6">
                     <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                       <Activity className="w-3.5 h-3.5 text-primary-600" />
                     </div>
                     <p className="text-xs font-medium text-sky-900 leading-relaxed">
                       This may take a few minutes. The analysis runs using AtherOps' security rules and your discovered resources.
                     </p>
                   </div>
                 </div>
               )}

               {/* STEP 8: COMPLETE */}
               {state.step === 8 && (
                 <div className="space-y-6">
                   {/* Illustration */}
                   <div className="relative h-40 flex items-center justify-center mb-8">
                      <div className="absolute w-32 h-32 bg-green-100 rounded-full blur-[40px] opacity-40"></div>
                      <Cloud className="w-32 h-32 text-sky-100 absolute bottom-0" />
                      <div className="relative z-10 w-16 h-16 bg-green-500 rounded-full shadow-lg border-4 border-white flex items-center justify-center animate-in zoom-in">
                        <Check className="w-8 h-8 text-white" />
                      </div>
                      {/* Particles */}
                      <div className="absolute top-4 left-1/4 w-2 h-2 bg-amber-400 rounded-full"></div>
                      <div className="absolute top-10 right-1/4 w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      <div className="absolute bottom-8 right-1/3 w-2 h-2 bg-green-400 rounded-full"></div>
                   </div>

                   {/* Summary Data */}
                   <div className="space-y-3 mb-8">
                     <div className="flex justify-between items-center py-2 border-b border-slate-100">
                       <span className="text-xs font-bold text-slate-500">Project</span>
                       <span className="text-sm font-bold text-slate-900">{state.projectName}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-b border-slate-100">
                       <span className="text-xs font-bold text-slate-500">AWS Account</span>
                       <span className="text-sm font-bold text-slate-900">{state.awsAccountId}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-b border-slate-100">
                       <span className="text-xs font-bold text-slate-500">Resources Discovered</span>
                       <span className="text-sm font-extrabold text-slate-900">{state.resourcesScanned}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-b border-slate-100">
                       <span className="text-xs font-bold text-slate-500">Security Findings</span>
                       <span className="text-sm font-extrabold text-slate-900">{state.findingsCreated}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-b border-slate-100">
                       <span className="text-xs font-bold text-slate-500">Attack Paths</span>
                       <span className="text-sm font-bold text-slate-400">Pending</span>
                     </div>
                   </div>

                   <button onClick={() => navigate(`/projects/${state.projectId}`, { replace: true })} className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 transition-all shadow-md shadow-primary-600/20">
                     Open Dashboard <ArrowRight className="w-4 h-4" />
                   </button>
                   
                   <div className="text-center mt-4">
                     <button className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                       View Security Findings
                     </button>
                   </div>
                 </div>
               )}

             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
