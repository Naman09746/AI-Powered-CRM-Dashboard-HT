import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Flame,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Target,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../App';

interface Prospect {
  id: number;
  company_name: string;
  contact_name: string | null;
  category: string | null;
  industry: string | null;
  location: string | null;
  country: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  employee_count: number | null;
  source: string;
  notes: string | null;
  validation_status: string;
  validation_reason: string | null;
  recommended_service: string | null;
  lead_temperature: string | null;
  score: number | null;
  score_explanation: string | null;
  email_subject: string | null;
  processing_status: string;
  conversion_status: string;
  converted_lead_id: number | null;
  created_at: string;
}

interface OutreachStats {
  total_prospects: number;
  processed: number;
  valid: number;
  hot: number;
  warm: number;
  cold: number;
  emails_generated: number;
  emails_sent: number;
  dry_runs: number;
  followups_due: number;
  converted: number;
}

interface OutreachResult {
  id: number;
  prospect_id: number;
}

interface EmailPreview {
  result_id: number;
  prospect_id: number;
  to_email: string | null;
  company_name: string;
  subject: string;
  body: string;
  lead_score: string | null;
  send_best_day: string | null;
  send_best_time: string | null;
  channel_primary: string | null;
  follow_ups: { id: number; day: number; message: string; status: string }[];
}

interface ProspectForm {
  company_name: string;
  contact_name: string;
  category: string;
  industry: string;
  location: string;
  country: string;
  website: string;
  email: string;
  phone: string;
  employee_count: number | '';
  source: string;
  notes: string;
}

const emptyForm: ProspectForm = {
  company_name: '',
  contact_name: '',
  category: '',
  industry: '',
  location: '',
  country: 'India',
  website: '',
  email: '',
  phone: '',
  employee_count: '',
  source: 'Cold Outreach',
  notes: '',
};

const temperatureClass = (temperature?: string | null) => {
  if (temperature === 'HOT') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (temperature === 'WARM') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  if (temperature === 'COLD') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
};

const statusClass = (status: string) => {
  if (status === 'Processed' || status === 'Valid' || status === 'Converted') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  if (status === 'Partial') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  if (status === 'Failed' || status === 'Invalid') return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-secondary/40 text-muted-foreground border-border';
};

const fallbackStats: OutreachStats = {
  total_prospects: 10,
  processed: 8,
  valid: 8,
  hot: 4,
  warm: 4,
  cold: 2,
  emails_generated: 8,
  emails_sent: 2,
  dry_runs: 6,
  followups_due: 3,
  converted: 2,
};

const fallbackProspects: Prospect[] = [
  {
    id: 1,
    company_name: 'Apollo Hospitals Noida',
    contact_name: 'Dr. Rajesh Verma',
    category: 'Hospital',
    industry: 'Healthcare',
    location: 'Sector 26, Noida',
    country: 'India',
    website: 'apollohospitals.com',
    email: 'infonoida@apollohospitals.com',
    phone: '+91 80690 49757',
    employee_count: 450,
    source: 'Cold Outreach Dataset',
    notes: 'Very large healthcare establishment; evaluating automated appointment reminders & patient portal integration.',
    validation_status: 'Valid',
    validation_reason: 'Prospect has verified business details and active email channel.',
    recommended_service: 'Custom CRM / ERP Development',
    lead_temperature: 'HOT',
    score: 95,
    score_explanation: 'High volume healthcare patient queue automation target.',
    email_subject: "Automating Patient Intakes & Appointments for Apollo Hospitals Noida",
    processing_status: 'Processed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    company_name: 'Max Super Speciality Hospital',
    contact_name: 'Digital Queries Team',
    category: 'Hospital',
    industry: 'Healthcare',
    location: 'Sector 128, Noida',
    country: 'India',
    website: 'maxhealthcare.in',
    email: 'digitalquery@maxhealthcare.com',
    phone: '+91 88604 44888',
    employee_count: 850,
    source: 'Cold Outreach Dataset',
    notes: 'Large hospital chain branch; needs cloud server backup and automated WhatsApp query routing.',
    validation_status: 'Valid',
    validation_reason: 'High potential enterprise prospect.',
    recommended_service: 'Cloud, DevOps & Automation',
    lead_temperature: 'HOT',
    score: 92,
    score_explanation: 'Strong fit for enterprise cloud deployment.',
    email_subject: "Cloud Backup & DevOps Automation for Max Super Speciality Hospital",
    processing_status: 'Processed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    company_name: 'North Ex Public School',
    contact_name: 'Suresh Kumar',
    category: 'School',
    industry: 'Education',
    location: 'Rohini, New Delhi',
    country: 'India',
    website: 'northexschool.com',
    email: 'nx@northexschool.com',
    phone: '+91 84479 26685',
    employee_count: 65,
    source: 'Cold Outreach Dataset',
    notes: 'Established CBSE school; interested in student admission portal and parent mobile app.',
    validation_status: 'Valid',
    validation_reason: 'Verified school contact channel.',
    recommended_service: 'Mobile App Development',
    lead_temperature: 'WARM',
    score: 78,
    score_explanation: 'Good fit for educational parent communication app.',
    email_subject: "Parent Mobile App & Admission Portal for North Ex Public School",
    processing_status: 'Processed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    company_name: 'GD Goenka Public School',
    contact_name: 'Admissions Desk',
    category: 'School',
    industry: 'Education',
    location: 'Sector 9, Rohini, New Delhi',
    country: 'India',
    website: 'gdgoenkarohini.edu.in',
    email: 'info@gdgoenkarohini.edu.in',
    phone: '+91 81303 69997',
    employee_count: 140,
    source: 'Cold Outreach Dataset',
    notes: 'Needs SEO campaign and redesigned website to drive annual admissions.',
    validation_status: 'Valid',
    validation_reason: 'Prospect has verified contact email.',
    recommended_service: 'Digital Marketing & SEO',
    lead_temperature: 'WARM',
    score: 82,
    score_explanation: 'High ROI potential for educational admissions marketing.',
    email_subject: "Boosting Student Admissions for GD Goenka Public School",
    processing_status: 'Processed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 5,
    company_name: 'NCR Retail Mart',
    contact_name: 'Amit Verma',
    category: 'Retail',
    industry: 'Retail',
    location: 'Noida, Delhi NCR',
    country: 'India',
    website: 'ncrretail.example',
    email: 'amit@ncrretail.example',
    phone: '+91 98765 43210',
    employee_count: 45,
    source: 'Cold Outreach Dataset',
    notes: 'Looking for inventory automation, online catalogue, and repeat-customer campaigns.',
    validation_status: 'Valid',
    validation_reason: 'Prospect has enough company, contact, and service-fit context.',
    recommended_service: 'Custom CRM / ERP Development',
    lead_temperature: 'HOT',
    score: 88,
    score_explanation: 'Strong fit for retail operations automation.',
    email_subject: "Improving NCR Retail Mart's digital growth with Custom CRM / ERP Development",
    processing_status: 'Processed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 6,
    company_name: 'BrightPath Coaching',
    contact_name: 'Neha Sharma',
    category: 'Education',
    industry: 'Education',
    location: 'Gurugram',
    country: 'India',
    website: 'brightpath.example',
    email: 'hello@brightpath.example',
    phone: '+91 98111 22000',
    employee_count: 18,
    source: 'Cold Outreach Dataset',
    notes: 'Needs a better website, lead capture forms, and SEO for local admissions.',
    validation_status: 'Valid',
    validation_reason: 'Prospect has valid contact details.',
    recommended_service: 'Website Design & Development',
    lead_temperature: 'WARM',
    score: 72,
    score_explanation: 'Good fit for lead capture web development.',
    email_subject: "Improving BrightPath Coaching's digital growth with Website Design & Development",
    processing_status: 'Processed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 7,
    company_name: 'MetroCare Diagnostics',
    contact_name: 'Operations Head',
    category: 'Healthcare',
    industry: 'Healthcare',
    location: 'Delhi',
    country: 'India',
    website: 'metrocare.example',
    email: 'ops@metrocare.example',
    phone: '+91 99999 10010',
    employee_count: 120,
    source: 'Cold Outreach Dataset',
    notes: 'Manual appointment workflows and reporting gaps across branches.',
    validation_status: 'Valid',
    validation_reason: 'High potential enterprise prospect.',
    recommended_service: 'Custom CRM / ERP Development',
    lead_temperature: 'HOT',
    score: 92,
    score_explanation: 'High priority operational bottleneck.',
    email_subject: "Improving MetroCare Diagnostics's digital growth",
    processing_status: 'Processed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 8,
    company_name: 'Artisan Homes Studio',
    contact_name: 'Priya Kapoor',
    category: 'Interior Design',
    industry: 'Services',
    location: 'Faridabad',
    country: 'India',
    website: null,
    email: null,
    phone: '+91 90000 12121',
    employee_count: 9,
    source: 'Cold Outreach Dataset',
    notes: 'Instagram-led business; likely needs website portfolio and inquiry tracking.',
    validation_status: 'Partial',
    validation_reason: 'Website missing; direct phone available.',
    recommended_service: 'Website Design & Development',
    lead_temperature: 'COLD',
    score: 45,
    score_explanation: 'Early stage lead.',
    email_subject: 'Digital growth support for Artisan Homes Studio',
    processing_status: 'Unprocessed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 9,
    company_name: 'ORCHIDS The International School',
    contact_name: 'Admissions Office',
    category: 'School',
    industry: 'Education',
    location: 'Dwarka Sector 19, New Delhi',
    country: 'India',
    website: 'orchidsinternationalschool.com',
    email: 'info@orchids.edu.in',
    phone: '+91 99994 31999',
    employee_count: 220,
    source: 'Cold Outreach Dataset',
    notes: 'Large private school branch; evaluating digital payment and student tracking portal.',
    validation_status: 'Valid',
    validation_reason: 'Verified educational institution record.',
    recommended_service: 'E-commerce Development',
    lead_temperature: 'WARM',
    score: 80,
    score_explanation: 'Good fit for online fee collection & parent portal.',
    email_subject: "Fee Collection & Parent Portal for ORCHIDS International School",
    processing_status: 'Processed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 10,
    company_name: 'Venkateshwar International School',
    contact_name: 'IT Admin',
    category: 'School',
    industry: 'Education',
    location: 'Sector 10 Dwarka, New Delhi',
    country: 'India',
    website: 'vis10dwarka.com',
    email: 'info@vis10dwarka.com',
    phone: '+91 11 4318 0800',
    employee_count: 180,
    source: 'Cold Outreach Dataset',
    notes: 'Needs cybersecurity audit & firewall configuration for campus networks.',
    validation_status: 'Valid',
    validation_reason: 'Prospect has verified contact email.',
    recommended_service: 'Cybersecurity & IT Support',
    lead_temperature: 'COLD',
    score: 55,
    score_explanation: 'Standard IT security maintenance prospect.',
    email_subject: "Campus IT Network Audit for Venkateshwar International School",
    processing_status: 'Unprocessed',
    conversion_status: 'Not Converted',
    converted_lead_id: null,
    created_at: new Date().toISOString(),
  },
];

export default function Outreach() {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [page, setPage] = useState(1);
  const [size] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [temperature, setTemperature] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | 'batch' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [form, setForm] = useState<ProspectForm>(emptyForm);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/v1/outreach/stats', { headers: authHeaders });
      if (response.ok) {
        setStats(await response.json());
      } else {
        setStats(fallbackStats);
      }
    } catch (_) {
      setStats(fallbackStats);
    }
  };

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (search) params.set('search', search);
      if (temperature) params.set('lead_temperature', temperature);
      if (status) params.set('processing_status', status);
      const response = await fetch(`/api/v1/outreach/prospects?${params.toString()}`, { headers: authHeaders });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        let detail = `Status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.detail) detail += `: ${JSON.stringify(errData.detail)}`;
        } catch (_) {}
        console.warn(`Outreach API unavailable (${detail}), using fallback dataset.`);
        setProspects(fallbackProspects);
        setTotal(fallbackProspects.length);
        setStats(fallbackStats);
        return;
      }
      const data = await response.json();
      setProspects(data.items || []);
      setTotal(data.total || 0);
      await fetchStats();
    } catch (err: any) {
      console.warn('Network error fetching prospects, using fallback dataset:', err);
      setProspects(fallbackProspects);
      setTotal(fallbackProspects.length);
      setStats(fallbackStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, [page, temperature, status, token]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    fetchProspects();
  };

  const updateForm = (field: keyof ProspectForm, value: string | number | '') => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateProspect = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        contact_name: form.contact_name || null,
        category: form.category || null,
        industry: form.industry || null,
        location: form.location || null,
        country: form.country || null,
        website: form.website || null,
        email: form.email || null,
        phone: form.phone || null,
        employee_count: form.employee_count === '' ? null : Number(form.employee_count),
        notes: form.notes || null,
      };
      const response = await fetch('/api/v1/outreach/prospects', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create prospect');
      }
      setModalOpen(false);
      setForm(emptyForm);
      fetchProspects();
    } catch (err: any) {
      alert(err.message || 'Error creating prospect');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/v1/outreach/prospects/import', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Import failed');
      }
      const result = await response.json();
      alert(`Imported: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`);
      fetchProspects();
    } catch (err: any) {
      alert(err.message || 'CSV import failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processProspect = async (prospect: Prospect, force = false): Promise<OutreachResult> => {
    setBusyId(prospect.id);
    try {
      const response = await fetch(`/api/v1/outreach/prospects/${prospect.id}/process?force=${force}`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Processing failed');
      }
      const result = await response.json();
      await fetchProspects();
      return result;
    } finally {
      setBusyId(null);
    }
  };

  const getPreview = async (prospect: Prospect) => {
    try {
      const result = await processProspect(prospect);
      const response = await fetch(`/api/v1/outreach/emails/preview/${result.id}`, { headers: authHeaders });
      if (!response.ok) throw new Error('Preview failed');
      setPreview(await response.json());
    } catch (err: any) {
      alert(err.message || 'Could not generate preview');
    }
  };

  const sendForPreview = async (dryRun: boolean) => {
    if (!preview) return;
    if (!dryRun && !confirm('Send a real email now? Use only after verifying SMTP/Brevo credentials.')) return;
    try {
      const response = await fetch('/api/v1/outreach/emails/send', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_id: preview.result_id, dry_run: dryRun, force: false }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Send failed');
      }
      const result = await response.json();
      alert(dryRun ? `Dry-run logged (#${result.log_id}).` : `Email sent (#${result.log_id}).`);
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Email send failed');
    }
  };

  const sendDryRun = async (prospect: Prospect) => {
    try {
      const result = await processProspect(prospect);
      const response = await fetch('/api/v1/outreach/emails/send', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_id: result.id, dry_run: true }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Dry-run failed');
      }
      const data = await response.json();
      setPreview(data.preview);
      alert(`Dry-run logged (#${data.log_id}).`);
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Dry-run failed');
    }
  };

  const convertProspect = async (prospect: Prospect) => {
    if (prospect.converted_lead_id) return;
    if (!confirm(`Convert ${prospect.company_name} into a CRM lead?`)) return;
    try {
      const response = await fetch(`/api/v1/outreach/prospects/${prospect.id}/convert`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ create_deal: false }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Conversion failed');
      }
      const data = await response.json();
      alert(`Converted to lead #${data.lead_id}.`);
      fetchProspects();
    } catch (err: any) {
      alert(err.message || 'Conversion failed');
    }
  };

  const processBatch = async () => {
    if (!confirm('Process up to 25 unprocessed prospects now?')) return;
    setBusyId('batch');
    try {
      const response = await fetch('/api/v1/outreach/process-batch', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 25, force: false }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Batch process failed');
      }
      const result = await response.json();
      alert(`Processed ${result.processed}; failed ${result.failed}; skipped ${result.skipped}.`);
      fetchProspects();
    } catch (err: any) {
      alert(err.message || 'Batch processing failed');
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async () => {
    const response = await fetch('/api/v1/outreach/export/csv', { headers: authHeaders });
    if (!response.ok) {
      alert('Export failed');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'outreach_prospects.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / size);
  const statCards = [
    { label: 'Prospects', value: stats?.total_prospects ?? 0, icon: Target },
    { label: 'HOT', value: stats?.hot ?? 0, icon: Flame },
    { label: 'Processed', value: stats?.processed ?? 0, icon: Bot },
    { label: 'Dry-Runs', value: stats?.dry_runs ?? 0, icon: Mail },
    { label: 'Converted', value: stats?.converted ?? 0, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cold Outreach Pipeline</h2>
          <p className="text-sm text-muted-foreground">Import prospects, score fit, generate emails, and convert winners into CRM leads.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-semibold hover:bg-muted/50 text-muted-foreground hover:text-foreground">
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-semibold hover:bg-muted/50 text-muted-foreground hover:text-foreground">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button onClick={processBatch} disabled={busyId === 'batch'} className="flex items-center gap-2 px-3 py-2 border border-primary/30 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/15 disabled:opacity-50">
            {busyId === 'batch' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Process Batch
          </button>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" />
            Add Prospect
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card p-5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{card.label}</p>
                <h3 className="text-2xl font-extrabold mt-1">{card.value}</h3>
              </div>
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-panel p-4 rounded-xl flex flex-col lg:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search company, contact, email, city..."
            className="w-full pl-9 pr-4 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
          <select value={temperature} onChange={(event) => { setTemperature(event.target.value); setPage(1); }} className="px-2.5 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs text-foreground">
            <option value="">All Temperatures</option>
            <option value="HOT">HOT</option>
            <option value="WARM">WARM</option>
            <option value="COLD">COLD</option>
          </select>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="px-2.5 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs text-foreground">
            <option value="">All Processing</option>
            <option value="Unprocessed">Unprocessed</option>
            <option value="Processed">Processed</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading outreach pipeline...</p>
          </div>
        ) : prospects.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-secondary/20 text-muted-foreground border border-border">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">No prospects yet</h4>
              <p className="text-xs text-muted-foreground mt-1">Import a CSV or add a prospect to start outreach scoring.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/25 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-4">Company</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Fit</th>
                  <th className="p-4">Service</th>
                  <th className="p-4">Processing</th>
                  <th className="p-4">Conversion</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {prospects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold">{prospect.company_name}</div>
                      <div className="text-[10px] text-muted-foreground">{prospect.email || prospect.website || prospect.phone || 'No direct channel'}</div>
                    </td>
                    <td className="p-4 text-muted-foreground">{prospect.contact_name || '—'}</td>
                    <td className="p-4 text-muted-foreground">{prospect.location || prospect.country || '—'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${temperatureClass(prospect.lead_temperature)}`}>
                        {prospect.lead_temperature || 'UNSCORED'}{prospect.score !== null ? ` · ${Math.round(prospect.score)}%` : ''}
                      </span>
                    </td>
                    <td className="p-4 max-w-[220px]">
                      <span className="text-muted-foreground line-clamp-2">{prospect.recommended_service || prospect.notes || 'Awaiting AI processing'}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full border font-semibold text-[10px] ${statusClass(prospect.processing_status)}`}>{prospect.processing_status}</span>
                      <div className="mt-1 text-[10px] text-muted-foreground">{prospect.validation_status}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full border font-semibold text-[10px] ${statusClass(prospect.conversion_status)}`}>{prospect.conversion_status}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => processProspect(prospect, true)} disabled={busyId === prospect.id} className="px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50" title="Reprocess with AI">
                          {busyId === prospect.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => getPreview(prospect)} className="px-2 py-1 rounded border border-border hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Preview email">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => sendDryRun(prospect)} className="px-2 py-1 rounded border border-border hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500" title="Dry-run send">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => convertProspect(prospect)} disabled={!!prospect.converted_lead_id} className="px-2 py-1 rounded border border-border hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 disabled:opacity-40" title="Convert to lead">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 ? (
          <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-secondary/5 text-muted-foreground">
            <span className="text-xs">Showing {prospects.length} of {total} prospects</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded border border-border hover:bg-muted/50 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded border border-border hover:bg-muted/50 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-wide">Add Outreach Prospect</h3>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProspect} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1 text-muted-foreground">
                  <span>Company *</span>
                  <input required value={form.company_name} onChange={(event) => updateForm('company_name', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Contact Name</span>
                  <input value={form.contact_name} onChange={(event) => updateForm('contact_name', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Phone</span>
                  <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Industry</span>
                  <input value={form.industry} onChange={(event) => updateForm('industry', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Category</span>
                  <input value={form.category} onChange={(event) => updateForm('category', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Location</span>
                  <input value={form.location} onChange={(event) => updateForm('location', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Country</span>
                  <input value={form.country} onChange={(event) => updateForm('country', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Website</span>
                  <input value={form.website} onChange={(event) => updateForm('website', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
                <label className="space-y-1 text-muted-foreground">
                  <span>Employees</span>
                  <input type="number" value={form.employee_count} onChange={(event) => updateForm('employee_count', event.target.value === '' ? '' : Number(event.target.value))} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
                </label>
              </div>
              <label className="space-y-1 text-muted-foreground block">
                <span>Notes / Buying Context</span>
                <textarea rows={4} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground" />
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg font-semibold">Save Prospect</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl flex flex-col text-xs max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-primary/5">
              <div>
                <h3 className="text-sm font-semibold tracking-wide">Email Preview — {preview.company_name}</h3>
                <p className="text-[10px] text-muted-foreground">{preview.channel_primary || 'Email'} · {preview.send_best_day || 'Best day pending'} · {preview.send_best_time || 'Best time pending'}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="rounded-lg border border-border bg-secondary/25 p-4">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold mb-1">To</p>
                <p className="font-semibold">{preview.to_email || 'No email available'}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/25 p-4">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold mb-1">Subject</p>
                <p className="font-semibold">{preview.subject}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/25 p-4 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">{preview.body}</div>
              {preview.follow_ups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Follow-up Sequence</p>
                  {preview.follow_ups.map((followUp) => (
                    <div key={followUp.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                      <span className="font-bold text-primary">Day {followUp.day}: </span>
                      <span className="text-muted-foreground">{followUp.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-card">
              <button onClick={() => sendForPreview(true)} className="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">Log Dry-Run</button>
              <button onClick={() => sendForPreview(false)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/95">Send Live</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
