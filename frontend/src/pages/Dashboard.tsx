import { useEffect, useState } from 'react';
import { useAuth } from '../App';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Flame,
  IndianRupee,
  Mail,
  RefreshCw,
  Send,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ChartItem {
  name: string;
  value: number;
}

interface FunnelItem {
  stage: string;
  count: number;
}

interface TimelineItem {
  date: string;
  count: number;
}

interface ProspectRow {
  company: string;
  email: string;
  category: string;
  location: string;
  lead_score: string;
  quality: string;
  confidence: number;
  pain_point: string;
  best_service: string;
  subject: string;
  sent: boolean;
  processed_at: string | null;
}

interface SendHistoryRow {
  id: number;
  email: string;
  company: string;
  subject: string;
  lead_score: string;
  status: string;
  sent_at: string | null;
  provider: string;
}

interface OutreachDashboard {
  prospects: {
    total: number;
    processed: number;
    unprocessed: number;
  };
  leads: {
    HOT: number;
    WARM: number;
    COLD: number;
    unscored: number;
  };
  quality: {
    good: number;
    partial: number;
    skip: number;
  };
  emails: {
    sent: number;
    dry_runs: number;
    failed: number;
  };
  followups_due: number;
  converted: number;
  categories: ChartItem[];
  services: ChartItem[];
  sources: ChartItem[];
  funnel: FunnelItem[];
  send_timeline: TimelineItem[];
  prospects_table: ProspectRow[];
  send_history: SendHistoryRow[];
  data_note: string;
}

interface KPIResponse {
  total_leads: number;
  active_clients: number;
  open_deals: number;
  closed_deals: number;
  total_revenue: number;
  conversion_rate: number;
  outreach: OutreachDashboard;
  revenue_trend: { month: string; revenue: number }[];
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

const formatNumber = (value: number | undefined) => (value ?? 0).toLocaleString('en-IN');
const formatCurrency = (value: number | undefined) => `₹${(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const scoreClass = (score: string) => {
  if (score === 'HOT') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (score === 'WARM') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  if (score === 'COLD') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
};

const qualityClass = (quality: string) => {
  if (['good', 'Valid'].includes(quality)) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  if (['partial', 'Partial'].includes(quality)) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  return 'bg-red-500/10 text-red-500 border-red-500/20';
};

const shortDate = (dateValue: string | null) => {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export default function Dashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<KPIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/v1/dashboard/kpis', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to retrieve dashboard analytics');
      setData(await response.json());
    } catch (err: any) {
      setError(err.message || 'Error fetching dashboard analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Building realistic outreach dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center max-w-md mx-auto glass-panel rounded-xl mt-12">
        <p className="text-destructive font-medium mb-3">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground mb-4">{error || 'No dashboard data returned.'}</p>
        <button onClick={fetchDashboardData} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/95 transition-all">
          Retry Sync
        </button>
      </div>
    );
  }

  const outreach = data.outreach;

  if (!outreach) {
    return (
      <div className="p-6 text-center max-w-md mx-auto glass-panel rounded-xl mt-12">
        <p className="text-destructive font-medium mb-3">Outreach data unavailable</p>
        <p className="text-sm text-muted-foreground mb-4">
          The backend may be running an older version. Try restarting the backend server and refreshing.
        </p>
        <button onClick={fetchDashboardData} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/95 transition-all">
          Retry Sync
        </button>
      </div>
    );
  }

  const temperatureData = [
    { name: 'HOT', value: outreach.leads.HOT },
    { name: 'WARM', value: outreach.leads.WARM },
    { name: 'COLD', value: outreach.leads.COLD },
    { name: 'Unscored', value: outreach.leads.unscored },
  ].filter((item) => item.value > 0);

  const qualityData = [
    { name: 'Good', value: outreach.quality.good },
    { name: 'Partial', value: outreach.quality.partial },
    { name: 'Skipped', value: outreach.quality.skip },
  ].filter((item) => item.value > 0);

  const kpis = [
    { name: 'Total Prospects', value: formatNumber(outreach.prospects.total), icon: Target, desc: 'Loaded from HT outreach CSV' },
    { name: 'Processed', value: formatNumber(outreach.prospects.processed), icon: Bot, desc: 'AI/synthetic enrichment ready' },
    { name: 'HOT Leads', value: formatNumber(outreach.leads.HOT), icon: Flame, desc: 'Highest outreach priority' },
    { name: 'Emails Sent', value: formatNumber(outreach.emails.sent), icon: Mail, desc: 'Live send logs generated' },
    { name: 'Due Follow-ups', value: formatNumber(outreach.followups_due), icon: Send, desc: 'Pending touchpoints' },
    { name: 'CRM Revenue', value: formatCurrency(data.total_revenue), icon: IndianRupee, desc: 'Won deals under ₹10L each' },
    { name: 'Open Deals', value: formatNumber(data.open_deals), icon: TrendingUp, desc: 'Active CRM opportunities' },
    { name: 'Active Clients', value: formatNumber(data.active_clients), icon: Users, desc: 'Qualified lead accounts' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            HT Cold Outreach Command Center
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-muted-foreground">{outreach.data_note}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/50 text-xs text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Synthetic enrichment fills missing score, send, and CRM values.
          </div>
          <button
            onClick={fetchDashboardData}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all border border-border"
            title="Refresh dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.name} className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between min-h-32">
              <div className="flex justify-between items-start gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.name}</span>
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight mt-3">{kpi.value}</h3>
                <span className="text-[10px] text-muted-foreground block mt-1 leading-normal">{kpi.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-panel p-6 rounded-xl min-h-[360px]">
          <div className="mb-5">
            <h4 className="text-sm font-semibold tracking-wide">Outreach Pipeline Funnel</h4>
            <p className="text-xs text-muted-foreground">Borrowed from the HT dashboard flow: total prospects → processed → validated → email activity.</p>
          </div>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outreach.funnel} layout="vertical" margin={{ top: 5, right: 24, left: 48, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                <XAxis type="number" stroke="#71717a" fontSize={11} />
                <YAxis type="category" dataKey="stage" stroke="#71717a" fontSize={11} width={110} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
                <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]} fill="#8b5cf6">
                  {outreach.funnel.map((_, index) => (
                    <Cell key={`funnel-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl min-h-[360px]">
          <div className="mb-5">
            <h4 className="text-sm font-semibold tracking-wide">Lead Temperature</h4>
            <p className="text-xs text-muted-foreground">HOT / WARM / COLD from CSV-backed scoring.</p>
          </div>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={temperatureData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={4}>
                  {temperatureData.map((_, index) => (
                    <Cell key={`temp-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {temperatureData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between px-2 py-1.5 rounded bg-secondary/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  {item.name}
                </span>
                <span className="text-xs font-bold">{formatNumber(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl min-h-[320px]">
          <h4 className="text-sm font-semibold tracking-wide mb-1">Top Prospect Categories</h4>
          <p className="text-xs text-muted-foreground mb-5">Actual categories loaded from `prospects_dataset.csv`.</p>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outreach.categories.slice(0, 8)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} interval={0} angle={-20} textAnchor="end" height={58} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
                <Bar dataKey="value" name="Prospects" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl min-h-[320px]">
          <h4 className="text-sm font-semibold tracking-wide mb-1">Recommended Services</h4>
          <p className="text-xs text-muted-foreground mb-5">Synthetic enrichment fills missing service fit.</p>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outreach.services.slice(0, 7)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" hide />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
                <Bar dataKey="value" name="Demand" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {outreach.services.slice(0, 3).map((item) => (
              <div key={item.name} className="flex justify-between text-[10px] text-muted-foreground bg-secondary/20 rounded px-2 py-1">
                <span className="truncate">{item.name}</span>
                <span className="font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl min-h-[320px]">
          <h4 className="text-sm font-semibold tracking-wide mb-1">Send Timeline</h4>
          <p className="text-xs text-muted-foreground mb-5">Recent synthetic/live outreach send activity.</p>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={outreach.send_timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickFormatter={(value: string) => value.slice(5)} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="count" name="Sends" stroke="#f59e0b" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-secondary/25 rounded-lg p-2 border border-border/50">
              <p className="text-[10px] text-muted-foreground">Dry Runs</p>
              <p className="text-sm font-bold">{formatNumber(outreach.emails.dry_runs)}</p>
            </div>
            <div className="bg-secondary/25 rounded-lg p-2 border border-border/50">
              <p className="text-[10px] text-muted-foreground">Failed</p>
              <p className="text-sm font-bold">{formatNumber(outreach.emails.failed)}</p>
            </div>
            <div className="bg-secondary/25 rounded-lg p-2 border border-border/50">
              <p className="text-[10px] text-muted-foreground">Converted</p>
              <p className="text-sm font-bold">{formatNumber(outreach.converted)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-panel rounded-xl overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-start gap-4">
            <div>
              <h4 className="text-sm font-semibold tracking-wide">Highest-Value Prospects</h4>
              <p className="text-xs text-muted-foreground">Sorted by synthetic confidence and lead score.</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded border border-primary/20 bg-primary/10 text-primary font-bold">Top 15</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/25 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-4">Company</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Fit</th>
                  <th className="p-4">Service</th>
                  <th className="p-4">Confidence</th>
                  <th className="p-4">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {outreach.prospects_table.map((prospect) => (
                  <tr key={`${prospect.company}-${prospect.email}`} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold max-w-[220px] truncate">{prospect.company}</div>
                      <div className="text-[10px] text-muted-foreground max-w-[220px] truncate">{prospect.location}</div>
                    </td>
                    <td className="p-4 text-muted-foreground">{prospect.category}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${scoreClass(prospect.lead_score)}`}>{prospect.lead_score}</span>
                      <span className={`ml-1 px-2 py-0.5 rounded-full border font-semibold text-[10px] ${qualityClass(prospect.quality)}`}>{prospect.quality}</span>
                    </td>
                    <td className="p-4 max-w-[260px]">
                      <span className="text-muted-foreground line-clamp-2">{prospect.best_service || prospect.pain_point}</span>
                    </td>
                    <td className="p-4 font-bold">{Math.round(prospect.confidence * 100)}%</td>
                    <td className="p-4">
                      {prospect.sent ? (
                        <span className="text-emerald-500 font-semibold">Sent</span>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl">
          <h4 className="text-sm font-semibold tracking-wide mb-1">Recent Send History</h4>
          <p className="text-xs text-muted-foreground mb-5">Latest email sends and dry-runs.</p>
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {outreach.send_history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No send history yet.</p>
            ) : (
              outreach.send_history.map((log) => (
                <div key={log.id} className="p-3 rounded-lg bg-secondary/20 border border-border/50 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold truncate">{log.company}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${scoreClass(log.lead_score)}`}>{log.lead_score}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{log.subject}</p>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-muted-foreground">
                    <span>{shortDate(log.sent_at)}</span>
                    <span className={log.status === 'failed' ? 'text-red-500' : 'text-emerald-500'}>{log.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-xl min-h-[300px]">
          <h4 className="text-sm font-semibold tracking-wide mb-1">Lead Quality</h4>
          <p className="text-xs text-muted-foreground mb-5">Good / partial / skipped records from validation.</p>
          <div className="w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={qualityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={5}>
                  {qualityData.map((_, index) => (
                    <Cell key={`quality-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl min-h-[300px]">
          <h4 className="text-sm font-semibold tracking-wide mb-1">CRM Revenue Trend</h4>
          <p className="text-xs text-muted-foreground mb-5">Synthetic won-deal history generated from prospect demand.</p>
          <div className="w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenue_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
                <YAxis stroke="#71717a" fontSize={11} tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`} />
                <Tooltip
                  formatter={(value: number | string) => formatCurrency(Number(value))}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="revenue" name="Won Revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
