import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  X,
  FileSpreadsheet,
  Sparkles,
  Mail,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

interface Lead {
  id: number;
  name: string;
  company_name: string | null;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  employee_count: number | null;
  source: string | null;
  status: string;
  notes: string | null;
  lead_score: number | null;
  created_at: string;
  owner?: { id: number; full_name: string; role: string };
}

interface ShapItem {
  feature: string;
  attribution: number;
  value: number;
}

interface ExplanationData {
  lead_id: number;
  lead_score: number;
  shaps: ShapItem[];
}

export default function Leads() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size] = useState(25);
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
  // Form State
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formIndustry, setFormIndustry] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formEmpCount, setFormEmpCount] = useState<number | ''>('');
  const [formSource, setFormSource] = useState('Website');
  const [formStatus, setFormStatus] = useState('New');
  const [formNotes, setFormNotes] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Lead Scoring Explanations State
  const [selectedExplLead, setSelectedExplLead] = useState<Lead | null>(null);
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [explLoading, setExplLoading] = useState(false);

  // AI Email Generator State
  const [emailLead, setEmailLead] = useState<Lead | null>(null);
  const [emailIntent, setEmailIntent] = useState('Cold Outreach');
  const [emailTone, setEmailTone] = useState('Professional');
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genCopied, setGenCopied] = useState(false);
  const [genMode, setGenMode] = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/leads/?page=${page}&size=${size}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (sourceFilter) url += `&source=${encodeURIComponent(sourceFilter)}`;
      if (industryFilter) url += `&industry=${encodeURIComponent(industryFilter)}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      setLeads(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, statusFilter, sourceFilter, industryFilter, token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLeads();
  };

  const handleOpenCreateModal = () => {
    setEditingLead(null);
    setFormName('');
    setFormCompany('');
    setFormIndustry('');
    setFormWebsite('');
    setFormEmail('');
    setFormPhone('');
    setFormCountry('');
    setFormEmpCount('');
    setFormSource('Website');
    setFormStatus('New');
    setFormNotes('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setFormName(lead.name);
    setFormCompany(lead.company_name || '');
    setFormIndustry(lead.industry || '');
    setFormWebsite(lead.website || '');
    setFormEmail(lead.email || '');
    setFormPhone(lead.phone || '');
    setFormCountry(lead.country || '');
    setFormEmpCount(lead.employee_count || '');
    setFormSource(lead.source || 'Website');
    setFormStatus(lead.status);
    setFormNotes(lead.notes || '');
    setModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formName,
        company_name: formCompany || null,
        industry: formIndustry || null,
        website: formWebsite || null,
        email: formEmail || null,
        phone: formPhone || null,
        country: formCountry || null,
        employee_count: formEmpCount === '' ? null : Number(formEmpCount),
        source: formSource || null,
        status: formStatus,
        notes: formNotes || null,
      };

      let response;
      if (editingLead) {
        response = await fetch(`/api/v1/leads/${editingLead.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/v1/leads/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) throw new Error('Failed to save lead');
      setModalOpen(false);
      
      // Re-trigger scoring background
      await fetch('/api/v1/ai/score-leads', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      fetchLeads();
    } catch (err) {
      console.error(err);
      alert('Error saving lead');
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const response = await fetch(`/api/v1/leads/${leadId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete lead');
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert('Error deleting lead');
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/v1/leads/export/csv', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'leads_export.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error exporting CSV');
    }
  };

  const handleImportCSVClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/v1/leads/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Import failed');
      }

      const res = await response.json();
      alert(res.message || 'Import successful!');
      
      // Calculate scores for imported leads
      await fetch('/api/v1/ai/score-leads', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Error importing CSV');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch ML SHAP explanations for selected lead score
  const handleOpenExplanation = async (lead: Lead) => {
    setSelectedExplLead(lead);
    setExplanation(null);
    setExplLoading(true);
    try {
      const response = await fetch(`/api/v1/ai/explain-lead/${lead.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setExplanation(data);
      }
    } catch (err) {
      console.error('Error fetching SHAP data', err);
    } finally {
      setExplLoading(false);
    }
  };

  // Generate Email via Gemini
  const handleGenerateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailLead) return;
    setGenLoading(true);
    setGeneratedDraft('');
    setGenCopied(false);
    try {
      const response = await fetch('/api/v1/ai/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lead_id: emailLead.id,
          intent: emailIntent,
          tone: emailTone
        })
      });

      if (response.status === 429) {
        const err = await response.json();
        throw new Error(err.detail || 'Rate limit hit.');
      }
      
      if (!response.ok) throw new Error('Failed to generate draft');
      const data = await response.json();
      setGeneratedDraft(data.draft);
      setGenMode(data.mode);
    } catch (err: any) {
      alert(err.message || 'Error generating email draft');
    } finally {
      setGenLoading(false);
    }
  };

  const handleCopyDraft = () => {
    if (!generatedDraft) return;
    navigator.clipboard.writeText(generatedDraft);
    setGenCopied(true);
    setTimeout(() => setGenCopied(false), 2000);
  };

  const totalPages = Math.ceil(total / size);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lead Database</h2>
          <p className="text-sm text-muted-foreground">Manage and filter system lead acquisitions</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <button 
            onClick={handleImportCSVClick}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-semibold hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-semibold hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search leads, companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
          <Search className="absolute left-3 top-2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs text-foreground focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Lost">Lost</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs text-foreground focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="Website">Website</option>
            <option value="Referral">Referral</option>
            <option value="Cold Reachout">Cold Reachout</option>
            <option value="Event">Event</option>
          </select>

          <select
            value={industryFilter}
            onChange={(e) => { setIndustryFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs text-foreground focus:outline-none"
          >
            <option value="">All Industries</option>
            <option value="Technology">Technology</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Finance">Finance</option>
            <option value="Defense">Defense</option>
            <option value="Education">Education</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Updating records...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-secondary/20 text-muted-foreground border border-border">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">No records match filters</h4>
              <p className="text-xs text-muted-foreground mt-1">Try resetting search parameters or create a new lead.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/25 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-4">Name</th>
                  <th className="p-4">Company</th>
                  <th className="p-4">Industry</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Source</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="p-4 font-medium">
                      <button
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="text-primary hover:underline flex items-center gap-1.5"
                      >
                        {lead.name}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      </button>
                    </td>
                    <td className="p-4 text-muted-foreground">{lead.company_name || '—'}</td>
                    <td className="p-4 text-muted-foreground">{lead.industry || '—'}</td>
                    <td className="p-4 text-muted-foreground">{lead.email || '—'}</td>
                    <td className="p-4 text-muted-foreground">{lead.source || '—'}</td>
                    <td className="p-4">
                      {lead.lead_score !== null ? (
                        <button 
                          onClick={() => handleOpenExplanation(lead)}
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-bold hover:brightness-95 transition-all text-[11px] ${
                            lead.lead_score >= 80 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            lead.lead_score >= 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          {lead.lead_score}
                        </button>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        lead.status === 'New' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        lead.status === 'Contacted' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                        lead.status === 'Qualified' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEmailLead(lead)}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                          title="Generate AI Email Draft"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleOpenEditModal(lead)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                          title="Edit Lead"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {user?.role === 'Admin' || user?.role === 'Manager' ? (
                          <button 
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {!loading && totalPages > 1 ? (
          <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-secondary/5 text-muted-foreground">
            <span className="text-xs">
              Showing {leads.length} of {total} records
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded border border-border hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded border border-border hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* SHAP score explanation modal popup */}
      {selectedExplLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-sm rounded-xl overflow-hidden shadow-2xl flex flex-col text-xs">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-secondary/5">
              <h3 className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Score Breakdown — {selectedExplLead.name}
              </h3>
              <button onClick={() => setSelectedExplLead(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center py-4 border-b border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">AI Likelihood Score</span>
                <h4 className="text-3xl font-extrabold text-primary mt-1">{selectedExplLead.lead_score}%</h4>
                <p className="text-[9px] text-muted-foreground mt-2">Active Mode: ML Model trained on Synthetic Historical Data</p>
              </div>

              {explLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : explanation?.shaps && explanation.shaps.length > 0 ? (
                <div className="space-y-3">
                  <h5 className="font-semibold text-muted-foreground mb-2">Contributing Factors (SHAP Weights):</h5>
                  {explanation.shaps.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-secondary/20 p-2.5 rounded-lg border border-border/50">
                      <span className="capitalize font-medium text-muted-foreground">{item.feature.replace('_', ' ')}</span>
                      <span className={`font-bold ${item.attribution >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {item.attribution >= 0 ? '+' : ''}{item.attribution}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No significant coefficients computed.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Email Generation Drawer/Modal */}
      {emailLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col text-xs max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-primary/5">
              <h3 className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Email Draft Assistant — {emailLead.name}
              </h3>
              <button onClick={() => setEmailLead(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateEmail} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Email Intent</label>
                  <select
                    value={emailIntent}
                    onChange={(e) => setEmailIntent(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="Cold Outreach">Cold Outreach</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Meeting Invitation">Meeting Invitation</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Tone Style</label>
                  <select
                    value={emailTone}
                    onChange={(e) => setEmailTone(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="Professional">Professional</option>
                    <option value="Friendly">Friendly</option>
                    <option value="Casual">Casual</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={genLoading}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {genLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Generate Email Draft
                </button>
              </div>

              {generatedDraft && (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <div className="flex justify-between items-center text-muted-foreground text-[10px]">
                    <span>Draft Mode: {genMode}</span>
                    <button
                      type="button"
                      onClick={handleCopyDraft}
                      className="flex items-center gap-1 hover:text-foreground hover:underline p-1"
                    >
                      {genCopied ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> Copy Draft</>
                      )}
                    </button>
                  </div>
                  
                  <div className="bg-secondary/40 border border-border rounded-lg p-4 font-mono text-[11px] whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                    {generatedDraft}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit/Create Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-wide">
                {editingLead ? 'Update Existing Lead' : 'Register New Lead'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Company</label>
                  <input
                    type="text"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Industry</label>
                  <input
                    type="text"
                    value={formIndustry}
                    onChange={(e) => setFormIndustry(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Website</label>
                  <input
                    type="text"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Country</label>
                  <input
                    type="text"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Employee Count</label>
                  <input
                    type="number"
                    value={formEmpCount}
                    onChange={(e) => setFormEmpCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Source</label>
                  <select
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Cold Reachout">Cold Reachout</option>
                    <option value="Event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">Internal Notes</label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg font-semibold"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
