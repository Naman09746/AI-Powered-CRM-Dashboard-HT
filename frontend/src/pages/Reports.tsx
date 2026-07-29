import { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { Lock, FileSpreadsheet, Printer } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface RepReport {
  representative: string;
  total_deals: number;
  total_value: number;
  won_value: number;
  won_count: number;
  win_rate: number;
}

interface IndustryReport {
  industry: string;
  total_leads: number;
  qualified_leads: number;
  conversion_rate: number;
}

interface SourceReport {
  source: string;
  total_leads: number;
  total_deals: number;
  revenue: number;
}

interface ReportsResponse {
  industry_report: IndustryReport[];
  representative_report: RepReport[];
  source_report: SourceReport[];
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function Reports() {
  const { token, user } = useAuth();
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/v1/reports/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 403) {
        throw new Error('Access denied. Reports are restricted to Managers and Admins.');
      }
      if (!response.ok) throw new Error('Failed to retrieve performance reports');
      const resData = await response.json();
      setData(resData);
    } catch (err: any) {
      setError(err.message || 'Error loading reports data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'Admin' || user?.role === 'Manager') {
      fetchReports();
    } else {
      setLoading(false);
    }
  }, [token, user]);

  const downloadReport = async (url: string, filename: string) => {
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error(err);
      alert('Error exporting report');
    }
  };

  const handleExportExcel = () => {
    downloadReport('/api/v1/reports/export/excel', 'crm_operational_report.xlsx');
  };

  const handleExportPrint = () => {
    downloadReport('/api/v1/reports/export/html', 'crm_performance_report.html');
  };

  // Lock screen for Executive role
  if (user?.role === 'Executive') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto p-8 glass-panel rounded-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-destructive/10 rounded-full blur-3xl pointer-events-none" />
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-full mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold tracking-tight">Access Restricted</h3>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Operational reporting, sales conversion data, and representative pipelines are visible only to Manager and Admin accounts. Please contact your administrator for reports access.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Aggregating company reports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center max-w-md mx-auto glass-panel rounded-xl mt-12">
        <p className="text-destructive font-medium mb-3">Failed to load Reports</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <button onClick={fetchReports} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 transition-all">
          Retry Aggregates
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Operational Reports</h2>
          <p className="text-sm text-muted-foreground">Monitor sales pipelines, lead channels, and staff metrics</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportPrint}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-semibold hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
          >
            <Printer className="w-4 h-4" />
            Print HTML / PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Excel Sheet
          </button>
        </div>
      </div>

      {/* Reports Metrics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Performance Chart */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between min-h-[350px]">
          <div className="mb-4">
            <h4 className="text-sm font-semibold tracking-wide">Sales Value by Representative</h4>
            <p className="text-xs text-muted-foreground">Comparing total deal values vs. won values</p>
          </div>
          <div className="w-full h-64">
            {data?.representative_report && data.representative_report.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.representative_report} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="representative" stroke="#71717a" fontSize={10} />
                  <YAxis stroke="#71717a" fontSize={10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    labelStyle={{ color: '#a1a1aa' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="total_value" name="Pipeline Value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="won_value" name="Won Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No representative deal statistics.</div>
            )}
          </div>
        </div>

        {/* Marketing Channels Performance Chart */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between min-h-[350px]">
          <div className="mb-4">
            <h4 className="text-sm font-semibold tracking-wide">Revenue by Ingestion Channel</h4>
            <p className="text-xs text-muted-foreground">Lead sources performance analysis</p>
          </div>
          <div className="w-full h-64 flex items-center justify-center">
            {data?.source_report && data.source_report.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.source_report}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="revenue"
                    nameKey="source"
                  >
                    {data.source_report.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No channels performance stats.</div>
            )}
          </div>
        </div>
      </div>

      {/* Reports Tables Details */}
      <div className="glass-panel rounded-xl overflow-hidden text-xs">
        <div className="p-4 border-b border-border bg-secondary/5">
          <h4 className="font-semibold text-xs tracking-wide">Industry Conversion Rates</h4>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-secondary/25 border-b border-border text-muted-foreground font-semibold">
              <th className="p-4">Industry Sector</th>
              <th className="p-4 text-right">Total Leads Ingested</th>
              <th className="p-4 text-right">Qualified Leads</th>
              <th className="p-4 text-right">Conversion Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {data?.industry_report.map((ind, idx) => (
              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                <td className="p-4 font-medium">{ind.industry}</td>
                <td className="p-4 text-right text-muted-foreground">{ind.total_leads}</td>
                <td className="p-4 text-right text-muted-foreground">{ind.qualified_leads}</td>
                <td className="p-4 text-right font-semibold text-primary">{ind.conversion_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
