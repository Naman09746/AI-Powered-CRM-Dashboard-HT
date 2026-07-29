import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { Sparkles, FileText, Calendar, Plus, X, ListTodo, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Meeting {
  id: number;
  title: string;
  transcript: string;
  summary: string | null;
  decisions: string | null;
  action_items: string | null;
  risks: string | null;
  created_at: string;
  lead?: { name: string } | null;
}

interface Lead {
  id: number;
  name: string;
}

export default function MeetingSummaries() {
  const { token } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [leadId, setLeadId] = useState<number | ''>('');
  const [genLoading, setGenLoading] = useState(false);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/advanced-ai/meetings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch meetings');
      const data = await response.json();
      setMeetings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/v1/leads/?size=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLeads(data.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetchLeads();
  }, [token]);

  const handleCreateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !transcript) return;
    setGenLoading(true);

    try {
      const response = await fetch('/api/v1/advanced-ai/meeting-summarizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          transcript,
          lead_id: leadId === '' ? null : Number(leadId)
        })
      });

      if (!response.ok) throw new Error('Failed to summarize transcript');
      
      setModalOpen(false);
      setTitle('');
      setTranscript('');
      setLeadId('');
      fetchMeetings();
    } catch (err) {
      console.error(err);
      alert('Error creating meeting summary');
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Meeting Summaries</h2>
          <p className="text-sm text-muted-foreground">Transcribe and extract key action items and risks</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Summarize Transcript
        </button>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Summary Lists */}
        <div className="md:col-span-1 space-y-4">
          <div className="glass-panel p-4 rounded-xl">
            <h4 className="font-semibold text-xs tracking-wide text-muted-foreground uppercase mb-3">Stored Summaries</h4>
            
            {loading ? (
              <div className="py-8 text-center flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : meetings.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-8">No summaries stored.</p>
            ) : (
              <div className="space-y-2">
                {meetings.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMeeting(m)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                      selectedMeeting?.id === m.id 
                        ? 'bg-primary/10 border-primary text-foreground font-semibold' 
                        : 'bg-secondary/20 border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="truncate font-semibold text-foreground">{m.title}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed summary viewer */}
        <div className="md:col-span-2">
          {selectedMeeting ? (
            <div className="glass-panel p-6 rounded-xl space-y-6">
              <div className="border-b border-border pb-4">
                <h3 className="text-lg font-bold tracking-tight">{selectedMeeting.title}</h3>
                <span className="text-xs text-muted-foreground block mt-1">
                  Summarized on {new Date(selectedMeeting.created_at).toLocaleString()} {selectedMeeting.lead ? `for lead: ${selectedMeeting.lead.name}` : ''}
                </span>
              </div>

              {/* Four blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Heuristic blocks */}
                <div className="bg-secondary/15 border border-border/50 p-4 rounded-lg space-y-2">
                  <h5 className="font-bold flex items-center gap-1.5 text-primary">
                    <FileText className="w-4 h-4" />
                    Summary
                  </h5>
                  <p className="text-muted-foreground leading-relaxed leading-normal">{selectedMeeting.summary}</p>
                </div>

                <div className="bg-secondary/15 border border-border/50 p-4 rounded-lg space-y-2">
                  <h5 className="font-bold flex items-center gap-1.5 text-emerald-500">
                    <ShieldCheck className="w-4 h-4" />
                    Decisions Made
                  </h5>
                  <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedMeeting.decisions}</div>
                </div>

                <div className="bg-secondary/15 border border-border/50 p-4 rounded-lg space-y-2">
                  <h5 className="font-bold flex items-center gap-1.5 text-purple-500">
                    <ListTodo className="w-4 h-4" />
                    Action Items
                  </h5>
                  <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedMeeting.action_items}</div>
                </div>

                <div className="bg-secondary/15 border border-border/50 p-4 rounded-lg space-y-2">
                  <h5 className="font-bold flex items-center gap-1.5 text-amber-500">
                    <AlertTriangle className="w-4 h-4" />
                    Potential Risks
                  </h5>
                  <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedMeeting.risks}</div>
                </div>
              </div>

              {/* Raw Transcript Toggle */}
              <details className="text-xs border-t border-border/50 pt-4">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-semibold select-none">
                  View raw transcript text
                </summary>
                <div className="mt-2 bg-secondary/30 p-4 rounded-lg font-mono text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto border border-border/40">
                  {selectedMeeting.transcript}
                </div>
              </details>
            </div>
          ) : (
            <div className="glass-panel p-12 text-center rounded-xl flex flex-col items-center justify-center min-h-[300px] text-muted-foreground text-xs gap-3">
              <FileText className="w-8 h-8" />
              <p>Select a meeting summary from the sidebar list, or upload a transcript file to summarize.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Summarizer */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col text-xs max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-secondary/5">
              <h3 className="text-sm font-semibold tracking-wide">Summarize Meeting Transcript</h3>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSummary} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block mb-1 text-muted-foreground">Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Roadmap Planning Meeting"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">Associated Lead (Optional)</label>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  <option value="">None</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">Meeting Transcript</label>
                <textarea
                  required
                  rows={8}
                  placeholder="Paste meeting logs, transcript lines, or dialogues here..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono text-[11px]"
                />
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
                  disabled={genLoading}
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {genLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Generate Summary
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
