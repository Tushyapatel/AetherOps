import { Link } from 'react-router-dom';
import { 
  Shield, 
  ArrowRight, 
  Cloud, 
  DollarSign, 
  Bot, 
  Database,
  BarChart3,
  Server,
  CheckCircle2,
  Cpu,
  Search,
  Eye,
  Network
} from 'lucide-react';
import { AtherOpsLogo } from '../components/AtherOpsLogo';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Landing() {
  usePageTitle('AtherOps');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* 1. NAVIGATION */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <AtherOpsLogo size={32} />
              <span className="text-xl font-bold text-navy-900 tracking-tight">AtherOps</span>
            </div>
            
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">How it Works</a>
              <a href="#benefits" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">Benefits</a>
            </div>

            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-primary-600 transition-colors">
                Login
              </Link>
              <Link 
                to="/signup" 
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
        {/* Background blobs for atmospheric cloud aesthetic */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] overflow-hidden -z-10 opacity-40 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[80%] rounded-full bg-blue-200 blur-[120px]" />
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-200 blur-[100px]" />
          <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] rounded-full bg-sky-100 blur-[100px]" />
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
          <div className="lg:w-1/2 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold tracking-wide uppercase">
              <Shield className="w-3.5 h-3.5" />
              AI-Powered Cloud Security & Operations
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-navy-900 leading-[1.15]">
              Secure Your Cloud.<br/>
              Optimize Your Costs.<br/>
              <span className="text-primary-600">See the Bigger Picture.</span>
            </h1>
            
            <p className="text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              AtherOps helps teams discover cloud resources, detect security risks, visualize attack paths, analyze cloud costs, compare workloads across providers, and get AI-powered insights — all in one place.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link 
                to="/signup" 
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3.5 rounded-xl font-semibold shadow-lg shadow-primary-600/20 transition-all hover:-translate-y-0.5"
              >
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Link>
              <a 
                href="#how-it-works" 
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-semibold transition-all shadow-sm hover:shadow"
              >
                See How It Works
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-4 text-sm font-medium text-slate-500">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Read-only AWS access</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> No long-lived credentials</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Setup in minutes</div>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="lg:w-1/2 relative w-full max-w-2xl mx-auto">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 overflow-hidden z-10">
              {/* Mock Dashboard UI Header */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4 px-2 pt-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="mx-auto text-xs font-semibold text-slate-400">atherops.com / Dashboard</div>
              </div>
              
              {/* Mock Dashboard Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-2">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Resources</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">247</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Open Findings</div>
                  <div className="text-xl font-bold text-red-600 mt-1">28</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Attack Paths</div>
                  <div className="text-xl font-bold text-amber-500 mt-1">12</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Monthly Cost</div>
                  <div className="text-xl font-bold text-primary-600 mt-1">$892</div>
                </div>
              </div>

              {/* Mock Chart & Paths */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2 mt-2">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 h-32 flex items-end gap-2 justify-between">
                  {[40, 70, 45, 90, 65, 80].map((h, i) => (
                    <div key={i} className="w-full bg-primary-200 rounded-t-sm" style={{ height: `${h}%` }}>
                      <div className="w-full bg-primary-500 rounded-t-sm transition-all" style={{ height: '20%' }} />
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2 flex flex-col justify-center">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5"><Server className="w-3 h-3 text-slate-400"/> EC2 <ArrowRight className="w-3 h-3"/> S3</span>
                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Critical</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-slate-400"/> Lambda <ArrowRight className="w-3 h-3"/> RDS</span>
                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">High</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5"><Database className="w-3 h-3 text-slate-400"/> ECS <ArrowRight className="w-3 h-3"/> IAM</span>
                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">High</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating nodes to imply cloud analysis */}
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-100 animate-[bounce_3s_ease-in-out_infinite] z-20">
               <Cloud className="w-8 h-8 text-sky-500" />
            </div>
            <div className="absolute top-1/2 -left-8 w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-100 animate-[bounce_4s_ease-in-out_infinite_0.5s] z-20">
               <Bot className="w-7 h-7 text-indigo-500" />
            </div>
            <div className="absolute -bottom-4 right-10 w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-100 animate-[bounce_3.5s_ease-in-out_infinite_1s] z-20">
               <Shield className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRODUCT STAT / TRUST STRIP */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <Eye className="w-6 h-6 text-primary-500" />
              <span className="text-sm font-bold text-navy-900 uppercase tracking-wide">Read-Only Access</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Search className="w-6 h-6 text-sky-500" />
              <span className="text-sm font-bold text-navy-900 uppercase tracking-wide">Infrastructure Discovery</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Shield className="w-6 h-6 text-red-500" />
              <span className="text-sm font-bold text-navy-900 uppercase tracking-wide">Deterministic Security</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-500" />
              <span className="text-sm font-bold text-navy-900 uppercase tracking-wide">Cost Explorer Sync</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-500" />
              <span className="text-sm font-bold text-navy-900 uppercase tracking-wide">Grounded AI</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CORE FEATURE CARDS */}
      <section id="features" className="py-24 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-navy-900 sm:text-4xl">Complete Cloud Intelligence</h2>
            <p className="mt-4 text-lg text-slate-600">AtherOps combines infrastructure visibility, security posture, and cost intelligence into a single unified platform.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Cloud} color="text-sky-500" bg="bg-sky-50"
              title="Cloud Resource Discovery" 
              desc="Discover and map your connected AWS resources instantly with read-only IAM access."
            />
            <FeatureCard 
              icon={Shield} color="text-red-500" bg="bg-red-50"
              title="Security Evaluation" 
              desc="Detect cloud misconfigurations, vulnerabilities, and security risks with deterministic rules."
            />
            <FeatureCard 
              icon={Network} color="text-amber-500" bg="bg-amber-50"
              title="Attack-Path Analysis" 
              desc="Visualize attack chains and understand the true blast radius of interconnected resources."
            />
            <FeatureCard 
              icon={DollarSign} color="text-green-500" bg="bg-green-50"
              title="Cost Intelligence" 
              desc="Understand actual AWS spending with native Cost Explorer integration and categorization."
            />
            <FeatureCard 
              icon={BarChart3} color="text-primary-500" bg="bg-primary-50"
              title="Cloud Comparison" 
              desc="Compare equivalent Compute, Storage, and Database workloads across AWS, Azure, and GCP."
            />
            <FeatureCard 
              icon={Bot} color="text-indigo-500" bg="bg-indigo-50"
              title="AI Assistant" 
              desc="Get grounded AI-powered explanations and actionable insights using your real AtherOps data."
            />
          </div>
        </div>
      </section>

      {/* 5. PRODUCT OVERVIEW */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 space-y-8">
              <div className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold tracking-widest uppercase">
                Built for Real-World Cloud Environments
              </div>
              <h2 className="text-3xl font-bold text-navy-900 sm:text-4xl leading-tight">
                From Cloud Visibility to AI-Powered Security and Cost Optimization
              </h2>
              <p className="text-lg text-slate-600">
                AtherOps gives you a complete view of your cloud environment so you can reduce risk, optimize costs, and make smarter technical decisions with AI-powered insights.
              </p>
              
              <ul className="space-y-4">
                {[
                  'Connect your AWS account with a secure read-only IAM role',
                  'Discover and analyze your cloud resources',
                  'Detect security risks and visualize attack paths',
                  'Understand and optimize your cloud costs',
                  'Compare workload costs across clouds',
                  'Get grounded AI-powered recommendations'
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary-600" />
                    </div>
                    <span className="text-slate-700 font-medium">{text}</span>
                  </li>
                ))}
              </ul>
              
              <div className="pt-4">
                <Link to="/signup" className="inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700 transition-colors">
                  Learn More About AtherOps <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:w-1/2 relative w-full h-[500px] bg-slate-50 rounded-3xl border border-slate-200 shadow-inner flex items-center justify-center overflow-hidden">
              {/* Conceptual Diagram */}
              <div className="absolute w-24 h-24 bg-primary-600 rounded-3xl shadow-xl z-20 flex flex-col items-center justify-center rotate-3 transition-transform hover:rotate-0 duration-300">
                <Shield className="w-10 h-10 text-white mb-1" />
                <span className="text-white font-bold text-xs">AtherOps</span>
              </div>
              
              <svg className="absolute inset-0 w-full h-full z-10" aria-hidden="true">
                <line x1="50%" y1="50%" x2="20%" y2="30%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="50%" y1="50%" x2="80%" y2="30%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="50%" y1="50%" x2="20%" y2="70%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="50%" y1="50%" x2="80%" y2="70%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="50%" y1="50%" x2="50%" y2="15%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="50%" y1="50%" x2="50%" y2="85%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
              </svg>

              <DiagramNode icon={Cloud} title="AWS Discovery" top="15%" left="50%" color="text-amber-500" />
              <DiagramNode icon={Shield} title="Security Findings" top="30%" left="20%" color="text-red-500" />
              <DiagramNode icon={DollarSign} title="Cost Intelligence" top="30%" left="80%" color="text-green-500" />
              <DiagramNode icon={Network} title="Attack Paths" top="70%" left="20%" color="text-orange-500" />
              <DiagramNode icon={BarChart3} title="Cloud Comparison" top="70%" left="80%" color="text-sky-500" />
              <DiagramNode icon={Bot} title="AI Assistant" top="85%" left="50%" color="text-indigo-500" />
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHY ATHEROPS / BENEFITS */}
      <section id="benefits" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold tracking-widest uppercase mb-4">
              Why AtherOps
            </div>
            <h2 className="text-3xl font-bold text-navy-900 sm:text-4xl">Everything You Need for a More Secure, Visible, and Cost-Aware Cloud</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BenefitCard 
              icon={Shield} 
              title="Stronger Security Posture" 
              desc="Detect misconfigurations and understand security risks with deterministic rules rather than guesswork." 
            />
            <BenefitCard 
              icon={DollarSign} 
              title="Better Cloud Cost Visibility" 
              desc="Understand actual AWS billing, explore resource costs, and compare hypothetical workloads across clouds." 
            />
            <BenefitCard 
              icon={Search} 
              title="Clearer Infrastructure Visibility" 
              desc="Discover resources and their relationships across your connected AWS environment instantly." 
            />
            <BenefitCard 
              icon={Bot} 
              title="Grounded AI Insights" 
              desc="Get explanations and analysis grounded directly in your AtherOps environment data—not generic advice." 
            />
          </div>
        </div>
      </section>

      {/* 7. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-navy-900">How AtherOps Works</h2>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 -translate-y-1/2" />
            
            {[
              { step: '01', title: 'Connect AWS', desc: 'Secure read-only IAM role' },
              { step: '02', title: 'Discover', desc: 'Map resources automatically' },
              { step: '03', title: 'Evaluate', desc: 'Security & cost analysis' },
              { step: '04', title: 'Optimize', desc: 'AI insights & remediation paths' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center bg-white px-4 py-6 md:py-0 text-center w-full md:w-1/4">
                <div className="w-12 h-12 bg-slate-50 border-2 border-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg mb-4">
                  {s.step}
                </div>
                <h3 className="text-lg font-bold text-navy-900">{s.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FINAL CTA */}
      <section className="py-24 bg-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/40 via-navy-900 to-navy-900"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 text-xs font-bold tracking-widest uppercase mb-6 border border-primary-500/30">
            Ready to secure your cloud?
          </div>
          <h2 className="text-4xl font-extrabold text-white sm:text-5xl tracking-tight mb-6">
            Join teams building a more secure, efficient cloud with AtherOps.
          </h2>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Connect your AWS environment and see your cloud from one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/signup" 
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-white hover:bg-slate-50 text-navy-900 px-8 py-4 rounded-xl font-bold shadow-xl transition-transform hover:-translate-y-0.5"
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-slate-400 font-medium">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary-400"/> Setup in minutes</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary-400"/> Read-only access</span>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="bg-slate-50 border-t border-slate-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <AtherOpsLogo size={24} />
                <span className="text-xl font-bold text-navy-900 tracking-tight">AtherOps</span>
              </div>
              <p className="text-sm text-slate-500 mb-6 max-w-xs">
                Secure. Optimize. See the Bigger Picture.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-navy-900 mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li><a href="#features" className="hover:text-primary-600">Features</a></li>
                <li><a href="#benefits" className="hover:text-primary-600">Benefits</a></li>
                <li><Link to="/signup" className="hover:text-primary-600">Get Started</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-navy-900 mb-4">Resources</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li><a href="#" className="hover:text-primary-600">Documentation</a></li>
                <li><a href="#" className="hover:text-primary-600">Guides</a></li>
                <li><a href="#" className="hover:text-primary-600">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-navy-900 mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li><a href="#" className="hover:text-primary-600">About</a></li>
                <li><a href="#" className="hover:text-primary-600">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-primary-600">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © 2026 AtherOps. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-slate-400">
              {/* Dummy social icons for visual completeness matching reference */}
              <a href="#" className="hover:text-slate-600"><span className="sr-only">GitHub</span><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg></a>
              <a href="#" className="hover:text-slate-600"><span className="sr-only">Twitter</span><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg></a>
              <a href="#" className="hover:text-slate-600"><span className="sr-only">LinkedIn</span><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" /></svg></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Subcomponents
function FeatureCard({ icon: Icon, title, desc, color, bg }: any) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-6`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <h3 className="text-xl font-bold text-navy-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function DiagramNode({ icon: Icon, title, top, left, color }: any) {
  return (
    <div 
      className="absolute bg-white rounded-xl shadow-md border border-slate-200 p-3 flex flex-col items-center justify-center gap-2 z-20 hover:-translate-y-1 transition-transform"
      style={{ top, left, transform: 'translate(-50%, -50%)', minWidth: '100px' }}
    >
      <Icon className={`w-6 h-6 ${color}`} />
      <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">{title}</span>
    </div>
  );
}

function BenefitCard({ icon: Icon, title, desc }: any) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex gap-6">
      <div className="shrink-0 w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-green-600" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-navy-900 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
