import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  ArrowLeft,
  Edit3,
  Mail,
  Phone,
  Globe,
  MapPin,
  StickyNote,
  Activity,
  DollarSign,
  Briefcase,
  Users,
  Sparkles,
  X,
  TrendingUp,
  Calendar,
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
  owner?: { id: number; full_name: string; role: string } | null;
}

interface Deal {
  id: number;
  title: string;
  value: number;
  stage: string;
  created_at: string;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
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

  const fetchLead = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch lead');
      const data = await response.json();
      setLead(data);
    } catch (err: any) {
      setError(err.message || 'Error loading lead');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeals = async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/v1/deals/?lead_id=${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDeals(Array.isArray(data) ? data : data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLead();
    fetchDeals();
  }, [id, token]);

  const handleOpenEditModal = () => {
    if (!lead) return;
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
    if (!lead) return;
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

      const response = await fetch(`/api/v1/leads/${lead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save lead');
      setModalOpen(false);
      fetchLead();
    } catch (err) {
      console.error(err);
      alert('Error saving lead');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'Contacted': return 'bg-purple-500/10 text-purple-500 border border-purple-500/20';
      case 'Qualified': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20';
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return '';
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
    if (score >= 50) return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    return 'bg-red-500/10 text-red-500 border border-red-500/20';
  };

  const getDealStageColor = (stage: string) => {
    switch (stage) {
      case 'Discovery': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'New': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Contacted': return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
      case 'Proposal': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'Negotiation': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Won': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Lost': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Closed Won': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Closed Lost': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-sm text-destructive">{error || 'Lead not found'}</p>
        <button
          onClick={() => navigate('/leads')}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leads
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/leads')}
            className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{lead.name}</h2>
            <p className="text-sm text-muted-foreground">
              {lead.company_name || 'No company'} {lead.industry ? `· ${lead.industry}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full font-semibold text-xs ${getStatusColor(lead.status)}`}>
            {lead.status}
          </span>
          {lead.lead_score !== null && (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${getScoreColor(lead.lead_score)}`}>
              <Sparkles className="w-3 h-3" />
              Score: {lead.lead_score}
            </span>
          )}
          <button
            onClick={handleOpenEditModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Lead
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Contact Info & Notes */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact Info Card */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-secondary/5">
              <h3 className="text-sm font-semibold tracking-wide">Contact Information</h3>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/30 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{lead.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/30 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{lead.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/30 text-muted-foreground">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-muted-foreground">Website</p>
                  {lead.website ? (
                    <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                      {lead.website}
                    </a>
                  ) : (
                    <p className="font-medium text-foreground">—</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/30 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-muted-foreground">Country</p>
                  <p className="font-medium text-foreground">{lead.country || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/30 text-muted-foreground">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-muted-foreground">Employees</p>
                  <p className="font-medium text-foreground">{lead.employee_count ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/30 text-muted-foreground">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-muted-foreground">Source</p>
                  <p className="font-medium text-foreground">{lead.source || '—'}</p>
                </div>
              </div>
            </div>
            {lead.owner && (
              <div className="px-6 py-4 border-t border-border bg-secondary/5">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Owner</p>
                <p className="text-xs font-medium">{lead.owner.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{lead.owner.role}</p>
              </div>
            )}
          </div>

          {/* Notes Card */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-secondary/5">
              <h3 className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                <StickyNote className="w-4 h-4 text-primary" />
                Notes
              </h3>
            </div>
            <div className="p-6">
              {lead.notes ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{lead.notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">No notes recorded for this lead.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column — Activity & Deals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Timeline */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-secondary/5">
              <h3 className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-primary" />
                Activity Timeline
              </h3>
            </div>
            <div className="p-6">
              <div className="relative pl-6 border-l-2 border-border/60 space-y-6">
                <div className="relative">
                  <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-primary border-2 border-background" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Lead Created</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(lead.created_at).toLocaleString(undefined, {
                        month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Lead "{lead.name}" registered in the system
                      {lead.source ? ` via ${lead.source}` : ''}
                    </p>
                  </div>
                </div>

                {lead.status !== 'New' && (
                  <div className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-purple-500 border-2 border-background" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Status Updated</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Status changed to <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${getStatusColor(lead.status)}`}>{lead.status}</span>
                      </p>
                    </div>
                  </div>
                )}

                {lead.lead_score !== null && (
                  <div className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-emerald-500 border-2 border-background" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">AI Score Assigned</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Machine learning model assigned a lead score of
                        <span className={`ml-1 font-bold ${lead.lead_score >= 80 ? 'text-emerald-500' : lead.lead_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {lead.lead_score}%
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Related Deals */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-secondary/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-primary" />
                Related Deals
              </h3>
              <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 bg-secondary/40 rounded-full">
                {deals.length} deal{deals.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-6">
              {deals.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No deals associated with this lead.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{deal.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] border ${getDealStageColor(deal.stage)}`}>
                            {deal.stage}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(deal.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-bold text-primary">
                          ${deal.value?.toLocaleString() || '0'}
                        </p>
                        <p className={`text-[10px] font-semibold ${
                          deal.stage === 'Won' ? 'text-emerald-500' : deal.stage === 'Lost' ? 'text-red-500' : 'text-muted-foreground'
                        }`}>
                          {deal.stage}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-wide">Edit Lead</h3>
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
