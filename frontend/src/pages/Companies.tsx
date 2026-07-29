import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Users,
  Globe,
  UserPlus,
} from 'lucide-react';

interface Company {
  id: number;
  name: string;
  industry: string | null;
  website: string | null;
  employee_count: number | null;
  created_at: string;
}

interface Contact {
  id: number;
  company_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export default function Companies() {
  const { token, user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size] = useState(25);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Company form state
  const [formName, setFormName] = useState('');
  const [formIndustry, setFormIndustry] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formEmpCount, setFormEmpCount] = useState<number | ''>('');

  // Expandable row state
  const [expandedCompanyId, setExpandedCompanyId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Contact modal state
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactCompanyId, setContactCompanyId] = useState<number | null>(null);
  const [formContactName, setFormContactName] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/companies/?page=${page}&size=${size}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (industryFilter) url += `&industry=${encodeURIComponent(industryFilter)}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      const data = await response.json();
      setCompanies(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContactsForCompany = async (companyId: number) => {
    setContactsLoading(true);
    try {
      const response = await fetch(`/api/v1/companies/${companyId}/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(Array.isArray(data) ? data : data.items ?? []);
    } catch (err) {
      console.error(err);
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [page, industryFilter, token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCompanies();
  };

  // ── Company CRUD ──────────────────────────────────────────────

  const handleOpenCreateModal = () => {
    setEditingCompany(null);
    setFormName('');
    setFormIndustry('');
    setFormWebsite('');
    setFormEmpCount('');
    setCompanyModalOpen(true);
  };

  const handleOpenEditModal = (company: Company) => {
    setEditingCompany(company);
    setFormName(company.name);
    setFormIndustry(company.industry || '');
    setFormWebsite(company.website || '');
    setFormEmpCount(company.employee_count || '');
    setCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formName,
        industry: formIndustry || null,
        website: formWebsite || null,
        employee_count: formEmpCount === '' ? null : Number(formEmpCount),
      };

      let response;
      if (editingCompany) {
        response = await fetch(`/api/v1/companies/${editingCompany.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/v1/companies/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) throw new Error('Failed to save company');
      setCompanyModalOpen(false);
      fetchCompanies();
    } catch (err) {
      console.error(err);
      alert('Error saving company');
    }
  };

  const handleDeleteCompany = async (companyId: number) => {
    if (!confirm('Are you sure you want to delete this company and all its contacts?')) return;
    try {
      const response = await fetch(`/api/v1/companies/${companyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete company');
      if (expandedCompanyId === companyId) {
        setExpandedCompanyId(null);
        setContacts([]);
      }
      fetchCompanies();
    } catch (err) {
      console.error(err);
      alert('Error deleting company');
    }
  };

  // ── Expandable row / Contacts ─────────────────────────────────

  const handleToggleExpand = async (companyId: number) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
      setContacts([]);
      return;
    }
    setExpandedCompanyId(companyId);
    fetchContactsForCompany(companyId);
  };

  // ── Contact CRUD ──────────────────────────────────────────────

  const handleOpenAddContact = (companyId: number) => {
    setEditingContact(null);
    setContactCompanyId(companyId);
    setFormContactName('');
    setFormContactEmail('');
    setFormContactPhone('');
    setContactModalOpen(true);
  };

  const handleOpenEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactCompanyId(contact.company_id);
    setFormContactName(contact.name);
    setFormContactEmail(contact.email || '');
    setFormContactPhone(contact.phone || '');
    setContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactCompanyId) return;
    try {
      const payload = {
        name: formContactName,
        email: formContactEmail || null,
        phone: formContactPhone || null,
      };

      let response;
      if (editingContact) {
        response = await fetch(`/api/v1/companies/contacts/${editingContact.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`/api/v1/companies/${contactCompanyId}/contacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) throw new Error('Failed to save contact');
      setContactModalOpen(false);
      setExpandedCompanyId(contactCompanyId);
      fetchContactsForCompany(contactCompanyId);
    } catch (err) {
      console.error(err);
      alert('Error saving contact');
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const response = await fetch(`/api/v1/companies/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete contact');
      if (expandedCompanyId) fetchContactsForCompany(expandedCompanyId);
    } catch (err) {
      console.error(err);
      alert('Error deleting contact');
    }
  };

  const totalPages = Math.ceil(total / size);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Companies & Contacts</h2>
          <p className="text-sm text-muted-foreground">Manage organizations and their contact persons</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
          <Search className="absolute left-3 top-2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={industryFilter}
            onChange={(e) => { setIndustryFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-secondary/30 border border-border rounded-lg text-xs text-foreground focus:outline-none"
          >
            <option value="">All Industries</option>
            <option value="Technology">Technology</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Finance">Finance</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Retail">Retail</option>
            <option value="Education">Education</option>
            <option value="Defense">Defense</option>
          </select>
        </div>
      </div>

      {/* Companies Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading companies...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-secondary/20 text-muted-foreground border border-border">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">No companies found</h4>
              <p className="text-xs text-muted-foreground mt-1">Try resetting filters or add a new company.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/25 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-4 w-8"></th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Industry</th>
                  <th className="p-4">Website</th>
                  <th className="p-4">Employees</th>
                  <th className="p-4">Created At</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {companies.map((company) => (
                  <React.Fragment key={company.id}>
                    <tr
                      className="hover:bg-muted/10 transition-colors cursor-pointer"
                      onClick={() => handleToggleExpand(company.id)}
                    >
                      <td className="p-4 text-muted-foreground">
                        {expandedCompanyId === company.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4" />
                        )}
                      </td>
                      <td className="p-4 font-medium">{company.name}</td>
                      <td className="p-4 text-muted-foreground">{company.industry || '—'}</td>
                      <td className="p-4">
                        {company.website ? (
                          <a
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="w-3 h-3" />
                            {company.website}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {company.employee_count != null ? company.employee_count.toLocaleString() : '—'}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(company.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEditModal(company)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                            title="Edit Company"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {(user?.role === 'Admin' || user?.role === 'Manager') && (
                            <button
                              onClick={() => handleDeleteCompany(company.id)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                              title="Delete Company"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded contacts section */}
                    {expandedCompanyId === company.id && (
                      <tr>
                        <td colSpan={7} className="bg-secondary/10 border-b border-border">
                          <div className="px-12 py-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                Contacts ({contacts.length})
                              </h4>
                              <button
                                onClick={() => handleOpenAddContact(company.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[11px] font-semibold transition-all border border-primary/20"
                              >
                                <UserPlus className="w-3 h-3" />
                                Add Contact
                              </button>
                            </div>

                            {contactsLoading ? (
                              <div className="flex justify-center py-4">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : contacts.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-3 text-center">
                                No contacts yet. Add one to get started.
                              </p>
                            ) : (
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                  <tr className="text-muted-foreground font-semibold border-b border-border/50">
                                    <th className="py-2 pr-4">Name</th>
                                    <th className="py-2 pr-4">Email</th>
                                    <th className="py-2 pr-4">Phone</th>
                                    <th className="py-2 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                  {contacts.map((contact) => (
                                    <tr key={contact.id} className="hover:bg-muted/10 transition-colors">
                                      <td className="py-2 pr-4 font-medium">{contact.name}</td>
                                      <td className="py-2 pr-4 text-muted-foreground">{contact.email || '—'}</td>
                                      <td className="py-2 pr-4 text-muted-foreground">{contact.phone || '—'}</td>
                                      <td className="py-2 text-right">
                                        <div className="flex justify-end gap-1.5">
                                          <button
                                            onClick={() => handleOpenEditContact(contact)}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                                            title="Edit Contact"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteContact(contact.id)}
                                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                            title="Delete Contact"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 ? (
          <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-secondary/5 text-muted-foreground">
            <span className="text-xs">
              Showing {companies.length} of {total} companies
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

      {/* Company Create/Edit Modal */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-wide">
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h3>
              <button onClick={() => setCompanyModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Company Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-muted-foreground">Industry</label>
                  <input
                    type="text"
                    value={formIndustry}
                    onChange={(e) => setFormIndustry(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-muted-foreground">Website</label>
                  <input
                    type="text"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="https://..."
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

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCompanyModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg font-semibold"
                >
                  {editingCompany ? 'Update Company' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Create/Edit Modal */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-wide">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <button onClick={() => setContactModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block mb-1 text-muted-foreground">Contact Name</label>
                <input
                  type="text"
                  required
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
              <div>
                <label className="block mb-1 text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={formContactEmail}
                  onChange={(e) => setFormContactEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
              <div>
                <label className="block mb-1 text-muted-foreground">Phone</label>
                <input
                  type="text"
                  value={formContactPhone}
                  onChange={(e) => setFormContactPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg font-semibold"
                >
                  {editingContact ? 'Update Contact' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
