import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Edit3, Trash2 } from 'lucide-react';

interface Deal {
  id: number;
  title: string;
  value: number;
  stage: string;
  lead_id: number;
  owner_id: number | null;
  closed_at: string | null;
  lead?: { name: string; company_name: string | null };
}

interface Lead {
  id: number;
  name: string;
  company_name: string | null;
}

const STAGES = ['New', 'Contacted', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export default function Pipeline() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  
  // Create Deal state
  const [title, setTitle] = useState('');
  const [value, setValue] = useState<number | ''>('');
  const [stage, setStage] = useState('New');
  const [leadId, setLeadId] = useState<number | ''>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch deals
      const dealsRes = await fetch('/api/v1/deals/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!dealsRes.ok) throw new Error('Failed to fetch deals');
      const dealsData = await dealsRes.json();
      
      // 2. Fetch leads (to associate new deals)
      const leadsRes = await fetch('/api/v1/leads/?size=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!leadsRes.ok) throw new Error('Failed to fetch leads');
      const leadsData = await leadsRes.json();

      // Resolve lead names for deals manually if backend doesn't populate it (or we can query)
      const leadsMap = new Map(leadsData.items.map((l: Lead) => [l.id, l]));
      const resolvedDeals = dealsData.items.map((deal: Deal) => ({
        ...deal,
        lead: leadsMap.get(deal.lead_id) || { name: 'Unknown Lead', company_name: null }
      }));

      setDeals(resolvedDeals);
      setLeads(leadsData.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, dealId: number) => {
    e.dataTransfer.setData('text/plain', dealId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow dropping
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const dealIdStr = e.dataTransfer.getData('text/plain');
    if (!dealIdStr) return;
    const dealId = parseInt(dealIdStr, 10);

    // Find local deal
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage === targetStage) return;

    // Optimistic Update
    const originalDeals = [...deals];
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: targetStage } : d));

    try {
      const response = await fetch(`/api/v1/deals/${dealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stage: targetStage })
      });
      if (!response.ok) throw new Error('Failed to update stage');
    } catch (err) {
      console.error(err);
      // Revert if API failed
      setDeals(originalDeals);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId || !title || value === '') return;

    try {
      const response = await fetch('/api/v1/deals/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          value: Number(value),
          stage,
          lead_id: Number(leadId)
        })
      });

      if (!response.ok) throw new Error('Failed to create deal');
      
      setModalOpen(false);
      setTitle('');
      setValue('');
      setLeadId('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error creating deal');
    }
  };

  const openEditModal = (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDeal(deal);
    setTitle(deal.title);
    setValue(deal.value);
    setStage(deal.stage);
    setLeadId(deal.lead_id);
    setEditModalOpen(true);
  };

  const handleUpdateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal || !title || value === '') return;

    try {
      const response = await fetch(`/api/v1/deals/${editingDeal.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          value: Number(value),
          stage,
          lead_id: Number(leadId)
        })
      });

      if (!response.ok) throw new Error('Failed to update deal');
      
      setEditModalOpen(false);
      setEditingDeal(null);
      setTitle('');
      setValue('');
      setLeadId('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error updating deal');
    }
  };

  const handleDeleteDeal = async (dealId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this deal?')) return;

    try {
      const response = await fetch(`/api/v1/deals/${dealId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete deal');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error deleting deal');
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingDeal(null);
    setTitle('');
    setValue('');
    setLeadId('');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Assembling sales pipelines...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header Panel */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales Pipeline</h2>
          <p className="text-sm text-muted-foreground">Manage deals stage progress via drag-and-drop</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Create Deal
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto pb-4 flex gap-4 min-h-[500px]">
        {STAGES.map((colStage) => {
          const colDeals = deals.filter(d => d.stage === colStage);
          const colTotalValue = colDeals.reduce((sum, d) => sum + d.value, 0);

          return (
            <div 
              key={colStage}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, colStage)}
              className="flex-shrink-0 w-80 bg-card/25 border border-border/80 rounded-xl flex flex-col max-h-[75vh]"
            >
              {/* Column Header */}
              <div className="p-4 border-b border-border/60 flex justify-between items-center bg-secondary/5">
                <div>
                  <h3 className="font-semibold text-xs tracking-wide text-foreground flex items-center gap-2">
                    {colStage}
                    <span className="text-[10px] px-1.5 py-0.2 bg-muted text-muted-foreground rounded font-bold">
                      {colDeals.length}
                    </span>
                  </h3>
                </div>
                <span className="text-xs font-bold text-primary">
                  ₹{colTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {colDeals.length === 0 ? (
                  <div className="h-28 border border-dashed border-border/40 rounded-lg flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">Drop deals here</span>
                  </div>
                ) : (
                  colDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal.id)}
                      className="glass-card p-4 rounded-lg cursor-grab active:cursor-grabbing hover:border-primary/45 transition-all text-xs group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-foreground truncate flex-1">{deal.title}</h4>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <button
                            onClick={(e) => openEditModal(deal, e)}
                            className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                            title="Edit deal"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          {(user?.role === 'Admin' || user?.role === 'Manager') && (
                            <button
                              onClick={(e) => handleDeleteDeal(deal.id, e)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Delete deal"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground mt-3">
                        <div className="flex flex-col gap-0.5 max-w-[70%]">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/leads/${deal.lead_id}`); }}
                            className="font-medium text-[10px] text-primary truncate hover:underline text-left"
                          >
                            {deal.lead?.name}
                          </button>
                          <span className="truncate text-[9px]">
                            {deal.lead?.company_name || 'Individual'}
                          </span>
                        </div>
                        <span className="font-bold text-foreground">
                          ₹{deal.value.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Deal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-xl overflow-hidden shadow-2xl flex flex-col text-xs">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-wide">Create New Deal</h3>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-muted-foreground">Deal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise License Contract"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">Associated Lead</label>
                <select
                  required
                  value={leadId}
                  onChange={(e) => setLeadId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  <option value="">Select a Lead...</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.company_name ? `(${l.company_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Deal Value (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="250000"
                    value={value}
                    onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Pipeline Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    {STAGES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
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
                  Create Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Deal Modal */}
      {editModalOpen && editingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-xl overflow-hidden shadow-2xl flex flex-col text-xs">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-wide">Edit Deal</h3>
              <button onClick={closeEditModal} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateDeal} className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-muted-foreground">Deal Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">Associated Lead</label>
                <select
                  required
                  value={leadId}
                  onChange={(e) => setLeadId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  <option value="">Select a Lead...</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.company_name ? `(${l.company_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Deal Value (₹)</label>
                  <input
                    type="number"
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Pipeline Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    {STAGES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={closeEditModal}
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
