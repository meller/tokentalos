import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Zap, 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  List, 
  LayoutGrid, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Clock,
  Filter,
  ArrowRight,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle
} from "lucide-react";
import { Treemap, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface Variable {
  name: string;
  token_count: number;
  char_count: number;
  position: number;
  content?: string;
  original_content?: string;
  preview?: string;
}

interface VariableAnalysis {
  variable_name: string;
  token_count: number;
  percentage: number;
  waste_reason: string | null;
  recommendation: string | null;
}

interface ExplainPlan {
  id: string;
  variable_analysis?: VariableAnalysis[];
  detected_issues: string[];
  optimization_suggestions: string[];
  estimated_savings_pct: number;
  estimated_savings_usd: number;
  mce_best_alternative_model?: string;
  mce_best_alternative_provider?: string;
  mce_best_alternative_cost?: number;
  mce_savings_pct?: number;
}

interface OPVResult {
  id: string;
  status: "on_track" | "uncertain" | "failed" | "looping" | "completed";
  confidence: number;
  reasoning: string;
  should_continue: boolean;
  verified_at: string;
}

interface DetailedExplanation {
  id: string;
  usage_id: string;
  endpoint: string;
  timestamp: string;
  provider: string;
  model: string;
  total_tokens: number;
  total_cost: number;
  total_saved_cost?: number;
  total_saved_tokens?: number;
  latency_ms: number | null;
  token_limit_exceeded?: boolean;
  variables: Variable[];
  explain_plan: ExplainPlan | null;
  opv_result?: OPVResult | null;
}

interface UsageStats {
  total_tokens: number;
  total_cost: number;
  total_saved_tokens: number;
  cache_saved_tokens: number;
  compression_saved_tokens: number;
  total_cache_hits: number;
  total_saved_cost: number;
  total_requests: number;
  pii_hits: number;
  security_alerts: number;
  potential_savings: number;
  by_provider: Array<{ provider: string; total_tokens: number; total_cost: number }>;
  by_model: Array<{ model: string; total_tokens: number; total_cost: number }>;
}

interface HeatmapData {
  heatmap: Array<{
    variable_name: string;
    total_tokens: number;
    request_count: number;
  }>;
}

const API_BASE_URL = window.location.origin + "/api";

function App() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [explanations, setExplanations] = useState<DetailedExplanation[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  
  const [activeTab, setActiveTab] = useState<"summary" | "prompts">("summary");
  const [heatmapView, setHeatmapView] = useState<"list" | "chart">("list");
  const [showAllHeatmap, setShowAllHeatmap] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyingOPV, setVerifyingOPV] = useState<Set<string>>(new Set());

  // Filters
  const [selectedProject, setSelectedProject] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterEndpoint, setFilterEndpoint] = useState("");
  const [showOnlyRecommendations, setShowOnlyRecommendations] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "tokens" | "cost">("date");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const formatCost = (cost: number) => {
    if (cost === 0) return "0.00";
    if (cost < 0.01) return cost.toFixed(6);
    return cost.toFixed(2);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const projectParam = selectedProject ? `?projectId=${selectedProject}` : "";
      const [statsRes, heatmapRes, explanationsRes, projectsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/v1/analytics/stats${projectParam}`),
        axios.get(`${API_BASE_URL}/v1/analytics/heatmap${projectParam}`),
        axios.get(`${API_BASE_URL}/v1/usage/recent${projectParam}`),
        axios.get(`${API_BASE_URL}/v1/analytics/projects`)
      ]);
      setStats(statsRes.data);
      setHeatmap(heatmapRes.data);
      setExplanations(explanationsRes.data);
      setProjects(projectsRes.data);
    } catch (err) {
      setError("Failed to connect to TokenTalos API");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProject]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterProvider, filterEndpoint, sortBy]);

  const handleVerifyWithOPV = async (item: DetailedExplanation) => {
    try {
      setVerifyingOPV(prev => new Set(prev).add(item.usage_id || item.id));
      
      const thinking = item.variables.find(v => v.name === 'thinking' || v.name === 'reasoning')?.content 
                    || item.variables[0]?.content || "No thinking tokens found.";

      const safety = item.variables.find(v => v.name === 'safety_guardrails')?.content;
      const taskDescription = safety 
        ? `Verification for endpoint ${item.endpoint}. Safety Guardrails: ${safety}`
        : `Verification for endpoint ${item.endpoint}`;

      const { data } = await axios.post(`${API_BASE_URL}/v1/opv/heartbeat`, {
        thinking_sample: thinking,
        task_description: taskDescription,
        previous_status: item.opv_result?.status
      });

      // Update local state with result
      setExplanations(prev => prev.map(exp => 
        (exp.usage_id === item.usage_id || exp.id === item.id) 
        ? { ...exp, opv_result: data } 
        : exp
      ));

    } catch (err) {
      console.error("OPV Verification failed:", err);
    } finally {
      setVerifyingOPV(prev => {
        const next = new Set(prev);
        next.delete(item.usage_id || item.id);
        return next;
      });
    }
  };

  const filteredExplanations = explanations
    .filter(exp => (filterProvider ? exp.provider === filterProvider : true))
    .filter(exp => (filterEndpoint ? exp.endpoint?.includes(filterEndpoint) : true))
    .filter(exp => {
      if (!showOnlyRecommendations) return true;
      return (
        exp.explain_plan?.mce_best_alternative_model || 
        (exp.explain_plan?.detected_issues?.length || 0) > 0 ||
        (exp.explain_plan?.optimization_suggestions?.length || 0) > 0
      );
    })
    .sort((a, b) => {
      if (sortBy === "tokens") return b.total_tokens - a.total_tokens;
      if (sortBy === "cost") return b.total_cost - a.total_cost;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  if (loading && !stats) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-slate-600 font-medium">Loading TokenTalos Analytics...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <Zap className="h-8 w-8 text-blue-600 fill-blue-600" />
              TokenTalos Analytics
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-slate-600">
                Monitor LLM usage across your local services.
              </p>
              <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 rounded border border-blue-100 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                <Filter className="h-3 w-3" />
                <select 
                  value={selectedProject} 
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="">All Projects</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm self-start">
            <button 
              onClick={() => setActiveTab("summary")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'summary' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Summary
            </button>
            <button 
              onClick={() => setActiveTab("prompts")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'prompts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Prompts ({filteredExplanations.length})
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        {activeTab === "summary" ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <Card 
                title="Total Tokens" 
                value={stats?.total_tokens.toLocaleString() || "0"} 
                subtitle={`across ${stats?.total_requests || 0} requests`}
                icon={<Zap className="h-5 w-5 text-amber-500" />}
              />
              <Card 
                title="Total Cost" 
                value={`$${formatCost(stats?.total_cost || 0)}`} 
                subtitle="USD (all time)"
                icon={<DollarSign className="h-5 w-5 text-green-500" />}
              />
              <Card 
                title="Avg Cost/Request" 
                value={`$${formatCost((stats?.total_cost || 0) / (stats?.total_requests || 1))}`} 
                subtitle="per API call"
                icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
              />
            </div>

            {/* Heatmap & Breakdowns */}
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">Token Heatmap</h2>
                      <p className="text-sm text-slate-500">Variable distribution (Last 30 Days)</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-md">
                      <button 
                        onClick={() => setHeatmapView("list")}
                        className={`p-1.5 rounded-sm transition-all ${heatmapView === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setHeatmapView("chart")}
                        className={`p-1.5 rounded-sm transition-all ${heatmapView === 'chart' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    {heatmap && heatmap.heatmap.length > 0 ? (
                      heatmapView === "list" ? (
                        <div className="space-y-4">
                          {(showAllHeatmap ? heatmap.heatmap : heatmap.heatmap.slice(0, 5)).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-indigo-400' : 'bg-slate-300'}`} />
                                <div>
                                  <p className="font-medium text-slate-900 capitalize">{item.variable_name}</p>
                                  <p className="text-xs text-slate-500">{item.request_count} requests</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-slate-900">{item.total_tokens.toLocaleString()}</p>
                                <p className="text-xs text-slate-500">tokens</p>
                              </div>
                            </div>
                          ))}
                          
                          {heatmap.heatmap.length > 5 && (
                            <button 
                              onClick={() => setShowAllHeatmap(!showAllHeatmap)}
                              className="w-full py-2 mt-2 text-xs font-bold text-slate-400 hover:text-blue-600 border-t border-slate-50 transition-colors uppercase tracking-widest"
                            >
                              {showAllHeatmap ? 'Show Less' : `Show All (${heatmap.heatmap.length})`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="h-80 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                              data={[{
                                name: 'Variables',
                                children: heatmap.heatmap.map(i => ({ 
                                  name: i.variable_name, 
                                  size: Math.max(i.total_tokens, 50) // Floor for visibility
                                }))
                              }]}
                              dataKey="size"
                              aspectRatio={4 / 3}
                              stroke="#fff"
                              fill="#3b82f6"
                              isAnimationActive={false}
                            >
                              <RechartsTooltip content={<CustomTreemapTooltip />} />
                            </Treemap>
                          </ResponsiveContainer>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-12">
                        <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-400">No usage data to visualize yet.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Active Guard Performance Section */}
                <div className="space-y-4">
                  {stats && stats.potential_savings > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500">
                      <div className="flex items-center gap-3 text-amber-900">
                        <TrendingUp className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="font-bold text-sm">Optimization Opportunity Identified</p>
                          <p className="text-xs opacity-80">You could have saved <strong>${stats.potential_savings.toFixed(4)}</strong> by using recommended alternative models.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setShowOnlyRecommendations(true);
                          setActiveTab("prompts");
                        }}
                        className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm"
                      >
                        View Recommendations
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <ShieldCheck className="h-6 w-6 text-blue-600" />
                      Active Guard Performance
                    </h2>
                    <button 
                      onClick={() => setActiveTab("prompts")}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1 group"
                    >
                      Deeper Analytics
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Caching Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm group hover:border-blue-500 transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <Zap className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Caching</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">
                        {stats?.cache_saved_tokens.toLocaleString() || "0"}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">Tokens saved via {stats?.total_cache_hits || 0} hits</p>
                    </div>

                    {/* Compression Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm group hover:border-indigo-500 transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <TrendingUp className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compression</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">
                        {stats?.compression_saved_tokens.toLocaleString() || "0"}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">Tokens saved via formatting</p>
                    </div>

                    {/* Privacy Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm group hover:border-teal-500 transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-teal-50 rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-all">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Privacy</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">
                        {stats?.pii_hits || "0"}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">Active PII redactions</p>
                    </div>

                    {/* Security Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm group hover:border-red-500 transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-all">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">
                        {stats?.security_alerts || "0"}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">Intercepted threats</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-800 leading-relaxed">
                      TokenTalos Active Guard has saved you a total of <strong>{stats?.total_saved_tokens.toLocaleString()} tokens</strong> (~${stats?.total_saved_cost.toFixed(4)}) 
                      by intercepting redundant requests and optimizing prompt payloads.
                    </p>
                  </div>
                </div>
              </div>

              <aside className="space-y-8">
                <BreakdownTable title="By Provider" items={stats?.by_provider || []} nameKey="provider" color="bg-indigo-500" />
                <BreakdownTable title="By Model" items={stats?.by_model || []} nameKey="model" color="bg-blue-400" />
                
                {/* Info Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-blue-500" />
                    Quick Guide
                  </h4>
                  <div className="space-y-4">
                    <GuideItem title="System" desc="Static instructions for the LLM behavior." color="bg-blue-500" />
                    <GuideItem title="Context" desc="RAG data or background information." color="bg-green-500" />
                    <GuideItem title="Safety" desc="Rules used as context for OPV verification." color="bg-red-500" />
                    <GuideItem title="Thinking" desc="Reasoning tokens for process analysis." color="bg-amber-500" />
                    <GuideItem title="Optimizer" desc="Model migration advice based on real costs." color="bg-indigo-600" />
                  </div>
                </div>
              </aside>
            </div>
          </>
        ) : (
          /* Prompts Tab */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-md border border-slate-100">
                <Filter className="h-4 w-4 text-slate-400" />
                <select 
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="bg-transparent text-sm font-medium focus:outline-none"
                >
                  <option value="">All Providers</option>
                  <option value="gemini">Gemini</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <input 
                  type="text"
                  placeholder="Filter by endpoint..."
                  value={filterEndpoint}
                  onChange={(e) => setFilterEndpoint(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 rounded-md border border-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sort:</span>
                <button 
                  onClick={() => setSortBy("date")}
                  className={`text-sm px-3 py-1 rounded-md transition-colors ${sortBy === 'date' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Date
                </button>
                <button 
                  onClick={() => setSortBy("tokens")}
                  className={`text-sm px-3 py-1 rounded-md transition-colors ${sortBy === 'tokens' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Tokens
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button 
                  onClick={() => setShowOnlyRecommendations(!showOnlyRecommendations)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${showOnlyRecommendations ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <TrendingUp className={`h-3 w-3 ${showOnlyRecommendations ? 'text-amber-600' : 'text-slate-400'}`} />
                  {showOnlyRecommendations ? 'Recommendations Active' : 'Filter by Recommendations'}
                </button>
              </div>
            </div>

            {/* Prompts List */}
            <div className="space-y-4">
              {filteredExplanations.length > 0 ? (
                <>
                  {filteredExplanations
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((exp) => (
                      <PromptItem 
                        key={exp.usage_id || exp.id} 
                        item={exp} 
                        isExpanded={expandedPrompt === (exp.usage_id || exp.id)}
                        onToggle={() => setExpandedPrompt(expandedPrompt === (exp.usage_id || exp.id) ? null : (exp.usage_id || exp.id))}
                        formatCost={formatCost}
                        onVerify={() => handleVerifyWithOPV(exp)}
                        isVerifying={verifyingOPV.has(exp.usage_id || exp.id)}
                      />
                    ))
                  }

                  {/* Pagination Controls */}
                  {filteredExplanations.length > itemsPerPage && (
                    <div className="flex items-center justify-center gap-2 mt-8 pt-6 border-t border-slate-200">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm font-bold text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-600"
                      >
                        Prev
                      </button>
                      
                      {Array.from({ length: Math.ceil(filteredExplanations.length / itemsPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first, last, and pages around current
                          return page === 1 || 
                                 page === Math.ceil(filteredExplanations.length / itemsPerPage) || 
                                 Math.abs(page - currentPage) <= 2;
                        })
                        .map((page, idx, arr) => (
                          <div key={page} className="flex items-center">
                            {idx > 0 && arr[idx-1] !== page - 1 && <span className="px-2 text-slate-300">...</span>}
                            <button 
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === page ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                              {page}
                            </button>
                          </div>
                        ))
                      }

                      <button 
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredExplanations.length / itemsPerPage), p + 1))}
                        disabled={currentPage === Math.ceil(filteredExplanations.length / itemsPerPage)}
                        className="px-3 py-1 text-sm font-bold text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-600"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                  <p className="text-slate-400">No prompts found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, subtitle, icon }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02] duration-300 group">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">{title}</h3>
        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">{icon}</div>
      </div>
      <div className="text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
      <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
    </div>
  );
}

function BreakdownTable({ title, items, nameKey, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4">
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-8 rounded-full ${color} opacity-60 group-hover:opacity-100 transition-opacity`} />
                  <div>
                    <p className="font-semibold text-slate-800 text-sm truncate max-w-[120px]">{item[nameKey]}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{item.total_tokens?.toLocaleString()} tokens</p>
                  </div>
                </div>
                <p className="font-mono text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">${item.total_cost?.toFixed(4)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic py-4 text-center">No data available</p>
        )}
      </div>
    </div>
  );
}

function PromptItem({ item, isExpanded, onToggle, formatCost, onVerify, isVerifying }: any) {
  return (
    <div className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' : 'border-slate-200 hover:border-slate-300 shadow-sm'}`}>
      <div 
        className="p-4 flex items-center justify-between cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-2 rounded-lg ${item.token_limit_exceeded ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
            <Clock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 truncate max-w-[300px]">{item.endpoint || '/api/v1/prompt'}</span>
              {item.token_limit_exceeded && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-tighter">Limit Exceeded</span>
              )}
              {item.opv_result && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  item.opv_result.status === 'on_track' ? 'bg-green-100 text-green-700' : 
                  item.opv_result.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  OPV: {item.opv_result.status}
                </span>
              )}
              {item.explain_plan?.mce_best_alternative_model && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-tighter flex items-center gap-1">
                  <TrendingUp className="h-2 w-2" />
                  Save {item.explain_plan.mce_savings_pct?.toFixed(0)}%
                </span>
              )}
              {(item.explain_plan?.detected_issues?.length > 0 || item.explain_plan?.optimization_suggestions?.length > 0) && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-tighter">
                  Insights
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
              <span>{new Date(item.timestamp).toLocaleString()} • <span className="uppercase">{item.provider}</span> {item.model}</span>
              
              {/* Migration Badge */}
              {item.explain_plan?.mce_best_alternative_model && (item.explain_plan.mce_savings_pct || 0) > 10 && (
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 border border-blue-200">
                  <TrendingUp className="h-2 w-2" />
                  Save {Math.round(item.explain_plan.mce_savings_pct)}%
                </span>
              )}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-8 text-right mr-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tokens</p>
              <p className="font-mono font-bold text-slate-900">{item.total_tokens?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost</p>
              <p className="font-mono font-bold text-blue-600">${formatCost(item.total_cost || 0)}</p>
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
      </div>

      {isExpanded && (
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 space-y-8 animate-in slide-in-from-top-2 duration-300">
          {/* Detailed Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DetailMetric label="Input Tokens" value={item.input_tokens || item.total_tokens} />
            <DetailMetric label="Output Tokens" value={item.output_tokens || 0} />
            <DetailMetric label="Latency" value={item.latency_ms ? `${item.latency_ms}ms` : 'N/A'} />
            <DetailMetric label="Status" value={item.token_limit_exceeded ? 'Warning' : 'Good'} color={item.token_limit_exceeded ? 'text-red-600' : 'text-green-600'} />
          </div>

          {/* Explain Plan (Issues & Suggestions) */}
          {(item.explain_plan?.detected_issues?.length > 0 || item.explain_plan?.optimization_suggestions?.length > 0) && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Engine Insights</h4>
              <div className="grid md:grid-cols-2 gap-4">
                {item.explain_plan.detected_issues.map((issue: string, idx: number) => (
                  <div key={idx} className="bg-red-50 p-3 rounded-lg border border-red-100 flex gap-3 text-red-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium leading-relaxed">{issue}</p>
                  </div>
                ))}
                {item.explain_plan.optimization_suggestions.map((suggestion: string, idx: number) => (
                  <div key={idx} className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex gap-3 text-amber-800">
                    <TrendingUp className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium leading-relaxed">{suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variable Breakdown */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variable Attribution & Recommendations</h4>
            <div className="grid gap-3">
              {item.variables?.map((v: any, idx: number) => {
                const analysis = item.explain_plan?.variable_analysis?.find((a: any) => a.variable_name === v.name);
                return (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:border-blue-200 transition-colors">
                    <div className="p-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-6 rounded-full ${analysis?.waste_reason ? 'bg-amber-500' : 'bg-blue-500'}`} />
                        <span className="font-bold text-slate-700 capitalize text-sm">{v.name}</span>
                        {analysis?.percentage && (
                          <span className="text-[10px] font-bold text-slate-400">({analysis.percentage.toFixed(0)}%)</span>
                        )}
                        {v.original_content && v.content && v.original_content.length > v.content.length && (
                          <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 text-[9px] font-black uppercase border border-green-100">
                            -{Math.round((1 - v.content.length / v.original_content.length) * 100)}% Smallest
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-slate-900">{v.token_count?.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-bold ml-2">TOKENS</span>
                      </div>
                    </div>
                    
                    {analysis?.waste_reason && (
                      <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-bold text-amber-800">{analysis.waste_reason}</p>
                          <p className="text-[10px] text-amber-700 mt-0.5 uppercase font-black tracking-tighter">Action: {analysis.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {v.content && (
                      <div className="p-3 bg-white">
                        <details className="group">
                          <summary className="list-none flex items-center gap-2 cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
                            <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                            {v.name} Content
                          </summary>
                          <div className="mt-3">
                            <pre className="text-[11px] font-mono text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-inner max-h-96 overflow-y-auto">
                              {v.content}
                            </pre>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* OPV Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-inner">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-blue-600" />
                <h4 className="font-bold text-slate-900">Reasoning Verification (OPV)</h4>
              </div>
              {!item.opv_result && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onVerify(); }}
                  disabled={isVerifying}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isVerifying ? <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <ShieldCheck className="h-3 w-3" />}
                  Verify Now
                </button>
              )}
            </div>
            
            {item.opv_result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    item.opv_result.status === 'on_track' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {item.opv_result.status === 'on_track' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {item.opv_result.status}
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    Confidence: {(item.opv_result.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <p className="text-sm text-slate-600 italic bg-slate-50 p-4 rounded-lg border-l-4 border-slate-200">
                  "{item.opv_result.reasoning}"
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No verification performed for this prompt yet.</p>
            )}
          </div>

          {/* Model Migration Insight (MCE) */}
          {item.explain_plan?.mce_best_alternative_model && (
            <div className="bg-blue-600 rounded-xl p-6 text-white flex items-start gap-4 shadow-xl shadow-blue-100 relative overflow-hidden">
              <TrendingUp className="absolute bottom-0 right-0 h-24 w-24 -mb-8 -mr-8 opacity-10 rotate-12" />
              <Zap className="h-8 w-8 text-yellow-300 relative z-10" />
              <div className="relative z-10">
                <p className="text-xs font-black uppercase tracking-widest opacity-80">Migration Opportunity Identified</p>
                <p className="text-lg mt-1 leading-relaxed font-bold">
                  Switch to <span className="underline underline-offset-4 text-yellow-200">{item.explain_plan.mce_best_alternative_model}</span>
                </p>
                <p className="text-sm text-blue-100 mt-1 opacity-90">
                  Current model is {item.model}. Switch to reduce costs by <strong className="text-white text-base">{item.explain_plan.mce_savings_pct?.toFixed(0)}%</strong> while maintaining reasoning logic.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailMetric({ label, value, color = 'text-slate-900' }: any) {
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm group hover:border-blue-500 transition-colors">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">{label}</p>
      <p className={`font-mono text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function GuideItem({ title, desc, color }: any) {
  return (
    <div className="flex gap-3">
      <div className={`w-1 h-auto rounded-full ${color}`} />
      <div>
        <p className="text-xs font-bold text-slate-800">{title}</p>
        <p className="text-[10px] text-slate-500 leading-tight">{desc}</p>
      </div>
    </div>
  );
}

const CustomTreemapTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-800 text-xs animate-in zoom-in-95">
        <p className="font-black uppercase tracking-widest mb-1 text-blue-400 border-b border-white/10 pb-1">{data.name}</p>
        <p className="font-mono"><span className="text-slate-400">Tokens:</span> {data.size?.toLocaleString()}</p>
        <p className="mt-1 text-[10px] text-slate-500 italic text-center">Click to filter logs</p>
      </div>
    );
  }
  return null;
};

export default App;
