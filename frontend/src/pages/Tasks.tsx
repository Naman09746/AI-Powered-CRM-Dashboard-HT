import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { Plus, CheckCircle, Circle, Calendar, Tag, Trash2, X } from 'lucide-react';

interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  recurring: string;
  lead_id: number | null;
  assigned_to_id: number | null;
  lead?: { name: string; company_name: string | null } | null;
}

interface Lead {
  id: number;
  name: string;
}

export default function Tasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [recurring, setRecurring] = useState('None');
  const [leadId, setLeadId] = useState<number | ''>('');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/tasks/?status=${statusFilter}&page=1&size=100`;
      if (priorityFilter) url += `&priority=${priorityFilter}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      setTasks(data.items || data);
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
    fetchTasks();
  }, [statusFilter, priorityFilter, token]);

  useEffect(() => {
    fetchLeads();
  }, [token]);

  const handleToggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));

    try {
      const response = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) throw new Error('Failed to toggle status');
      fetchTasks();
    } catch (err) {
      console.error(err);
      fetchTasks(); // Revert
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      const payload = {
        title,
        description: description || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority,
        recurring,
        lead_id: leadId === '' ? null : Number(leadId),
      };

      const response = await fetch('/api/v1/tasks/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to create task');
      
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('Medium');
      setRecurring('None');
      setLeadId('');
      fetchTasks();
    } catch (err) {
      console.error(err);
      alert('Error creating task');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete task');
      fetchTasks();
    } catch (err) {
      console.error(err);
      alert('Error deleting task');
    }
  };

  const getPriorityColor = (pri: string) => {
    switch (pri) {
      case 'High': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'Medium': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Task Manager</h2>
          <p className="text-sm text-muted-foreground">Keep track of your client engagement deadlines</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Create Task
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 rounded-xl flex gap-4 items-center">
        <div className="flex gap-2 bg-secondary/35 p-1 rounded-lg border border-border">
          {['Pending', 'Completed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                statusFilter === st 
                  ? 'bg-primary text-primary-foreground shadow' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs text-foreground focus:outline-none"
        >
          <option value="">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center glass-panel rounded-xl flex flex-col items-center justify-center gap-3">
            <CheckCircle className="w-8 h-8 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-semibold">No tasks found</h4>
              <p className="text-xs text-muted-foreground mt-1">Hooray! Your schedule is completely clear.</p>
            </div>
          </div>
        ) : (
          tasks.map((task) => (
            <div 
              key={task.id} 
              className={`glass-card p-4 rounded-xl flex items-center justify-between border-l-4 transition-all ${
                task.status === 'Completed' ? 'opacity-60 border-l-zinc-500' : 'border-l-primary'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {/* Status Toggle Checkbox */}
                <button 
                  onClick={() => handleToggleStatus(task)}
                  className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                >
                  {task.status === 'Completed' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="min-w-0">
                  <h4 className={`font-semibold text-sm ${task.status === 'Completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate max-w-lg">{task.description}</p>
                  )}
                  
                  {/* Task Tags Metadata */}
                  <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground font-medium">
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    <span className={`inline-block px-1.5 py-0.2 rounded border font-semibold ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    {task.recurring !== 'None' && (
                      <span className="flex items-center gap-1 bg-secondary px-1.5 rounded">
                        <Tag className="w-3 h-3" />
                        {task.recurring}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              <button 
                onClick={() => handleDeleteTask(task.id)}
                className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-4"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Task Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-xl overflow-hidden shadow-2xl flex flex-col text-xs">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-wide">Create New Task</h3>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-muted-foreground">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule proposal follow up"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">Description</label>
                <textarea
                  rows={2}
                  placeholder="Add details about the task..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Associated Lead</label>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Recurring Status</label>
                  <select
                    value={recurring}
                    onChange={(e) => setRecurring(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="None">None (One-off)</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
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
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
