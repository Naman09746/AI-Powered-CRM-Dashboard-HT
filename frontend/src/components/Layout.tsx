import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
  LogOut, 
  User as UserIcon,
  Briefcase,
  CheckSquare,
  BarChart3,
  Bell,
  Check,
  Video,
  Sparkles,
  Send,
  MessageSquare,
  ChevronDown,
  Search,
  Building2,
  UserCog,
  Target
} from 'lucide-react';
import { useAuth } from '../App';
import ThemeToggle from './ThemeToggle';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  read: boolean;
  type: string;
  created_at: string;
}

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { token, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Command Palette State
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');

  // AI Assistant Chat Widget State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { sender: 'assistant', text: 'Hi! I am your read-only CRM Conversational Assistant. I can answer questions about leads, revenue, and checklist tasks.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Build menu items list
  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, desc: 'View summary KPIs and forecast charts' },
    { name: 'Leads', path: '/leads', icon: Users, desc: 'Manage lead database and score profiles' },
    { name: 'Pipeline', path: '/pipeline', icon: GitBranch, desc: 'Drag-and-drop sales deals Kanban' },
    { name: 'Outreach', path: '/outreach', icon: Target, desc: 'Score cold prospects and send campaigns' },
    { name: 'Companies', path: '/companies', icon: Building2, desc: 'Manage companies and contacts' },
    { name: 'Tasks', path: '/tasks', icon: CheckSquare, desc: 'Track task checklists and deadlines' },
    { name: 'Meetings', path: '/meetings', icon: Video, desc: 'Summarize meeting transcripts via AI' },
  ];

  if (user?.role === 'Admin' || user?.role === 'Manager') {
    menuItems.push({ name: 'Reports', path: '/reports', icon: BarChart3, desc: 'Analyze sales metrics and download sheets' });
  }

  if (user?.role === 'Admin') {
    menuItems.push({ name: 'Users', path: '/users', icon: UserCog, desc: 'Manage user accounts and roles' });
  }

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/v1/notifications/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // WebSocket with reconnection logic
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const baseDelay = 1000;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/notifications/ws?token=${token}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const newNotif = JSON.parse(event.data);
          if (newNotif.type !== 'ping') {
            setNotifications(prev => [newNotif, ...prev]);
          }
        } catch (err) {
          console.error(err);
        }
      };

      ws.onclose = (event) => {
        if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    // Hotkey listener for Command Palette (Ctrl+K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatOpen]);

  const handleMarkAsRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await fetch('/api/v1/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const query = customMsg || chatMessage;
    if (!query.trim()) return;

    setChatHistory(prev => [...prev, { sender: 'user', text: query }]);
    setChatMessage('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/v1/advanced-ai/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: query })
      });

      if (response.status === 429) {
        setChatHistory(prev => [...prev, { sender: 'assistant', text: 'Rate limit hit. Please wait.' }]);
        return;
      }

      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setChatHistory(prev => [...prev, { sender: 'assistant', text: data.response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { sender: 'assistant', text: 'Sorry, I encountered an error searching records.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePaletteNavigate = (path: string) => {
    setPaletteOpen(false);
    setPaletteSearch('');
    navigate(path);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'Manager': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      default: return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
    }
  };

  const quickQuestions = [
    "How many leads do we have?",
    "What is our won revenue?",
    "Show my pending tasks",
    "Show hot prospects"
  ];

  // Filter menu items for Command Palette
  const filteredPaletteItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(paletteSearch.toLowerCase()) ||
    item.desc.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/40 backdrop-blur-md flex flex-col justify-between p-4 hidden md:flex">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-3 py-4 mb-6">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Enterprise CRM</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Hub</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                      : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-4 pt-4 border-t border-border">
          {/* User Widget */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border">
              <UserIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-medium truncate">{user?.full_name}</h4>
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-1 ${getRoleColor(user?.role || '')}`}>
                {user?.role}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors text-sm font-medium"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs">Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/25 backdrop-blur-md flex items-center justify-between px-6 gap-4 relative z-30">
          {/* Global search trigger for Command Palette */}
          <button 
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-secondary/35 hover:bg-secondary/60 text-muted-foreground hover:text-foreground rounded-lg border border-border text-xs w-48 md:w-64 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search or hit Ctrl+K</span>
          </button>

          {/* Action Items on Right */}
          <div className="flex items-center gap-3 relative">
            {/* Real-time Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all relative border border-border/60"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown list */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden text-xs z-50">
                  <div className="p-3 border-b border-border flex justify-between items-center bg-secondary/15">
                    <span className="font-bold">Live Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-muted-foreground text-[10px]">No notifications yet.</p>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          className={`p-3 transition-colors hover:bg-secondary/20 flex gap-2 ${!notif.read ? 'bg-primary/5' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className={`font-semibold ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>{notif.title}</h5>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">{notif.message}</p>
                          </div>
                          {!notif.read && (
                            <button 
                              onClick={() => handleMarkAsRead(notif.id)}
                              className="text-primary hover:text-emerald-500 self-start p-1"
                              title="Mark read"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle in Header (Desktop & Mobile) */}
            <ThemeToggle className="hidden sm:inline-flex" />

            {/* Small screen role tag */}
            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold md:hidden ${getRoleColor(user?.role || '')}`}>
              {user?.role}
            </span>
            
            <div className="sm:hidden">
              <ThemeToggle />
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors md:hidden"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Page */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>

        {/* ========================================================
            Conversational AI Assistant (Floating bubble + Chat drawer)
            ======================================================== */}
        <div className="fixed bottom-6 right-6 z-40">
          {!chatOpen ? (
            <button
              onClick={() => setChatOpen(true)}
              className="p-4 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground shadow-2xl flex items-center justify-center transition-all hover:scale-105"
              title="Open CRM AI Assistant"
            >
              <MessageSquare className="w-6 h-6 animate-pulse" />
            </button>
          ) : (
            <div className="w-80 h-96 glass-panel border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden text-xs">
              <div className="p-3 border-b border-border bg-primary/10 flex justify-between items-center">
                <span className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  CRM AI Assistant
                </span>
                <button 
                  onClick={() => setChatOpen(false)} 
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {chatHistory.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2.5 rounded-lg max-w-[85%] leading-normal ${
                      msg.sender === 'user' 
                        ? 'ml-auto bg-primary/20 text-foreground border border-primary/20' 
                        : 'mr-auto bg-secondary/40 text-muted-foreground border border-border/40'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="mr-auto bg-secondary/40 text-muted-foreground border border-border/40 p-2.5 rounded-lg flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Searching records...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {chatHistory.length < 3 && (
                <div className="p-2 border-t border-border/40 flex flex-wrap gap-1 bg-secondary/5">
                  {quickQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => handleSendChatMessage(e, q)}
                      className="px-2 py-1 bg-secondary/50 hover:bg-primary/10 text-[9px] text-muted-foreground hover:text-primary rounded-full transition-all border border-border/50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendChatMessage} className="p-2 border-t border-border flex gap-2 bg-card">
                <input
                  type="text"
                  placeholder="Ask about leads, tasks or sales..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <button
                  type="submit"
                  className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/95 flex items-center justify-center transition-all shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          Global Search Command Palette (Ctrl+K Modal)
          ======================================================== */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[15vh]">
          <div className="glass-panel w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col text-xs">
            <div className="p-3 border-b border-border flex items-center gap-2 bg-secondary/10">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                autoFocus
                placeholder="Search menu shortcuts..."
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder-muted-foreground text-sm"
              />
              <button 
                onClick={() => setPaletteOpen(false)}
                className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-secondary/40 text-muted-foreground"
              >
                ESC
              </button>
            </div>
            
            <div className="p-2 max-h-60 overflow-y-auto space-y-1">
              {filteredPaletteItems.length === 0 ? (
                <p className="p-4 text-center text-muted-foreground">No matches found.</p>
              ) : (
                filteredPaletteItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handlePaletteNavigate(item.path)}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-3"
                    >
                      <div className="p-1.5 rounded bg-secondary text-muted-foreground">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold block text-foreground text-xs">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
