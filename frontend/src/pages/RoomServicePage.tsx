import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Coffee, Play, Check, Send } from 'lucide-react';

interface ServiceRequest {
  id: string;
  category: string;
  title: string;
  notes: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  requestedAt: string;
  completedAt: string | null;
  roomNumber: string;
  guestName: string;
}

const categoryIcons: Record<string, string> = {
  BREAKFAST: '🍳',
  LUNCH: '🍔',
  DINNER: '🥩',
  LAUNDRY: '🧺',
  CLEANING: '🧹',
  EXTRA_BED: '🛏️',
  WAKE_UP_CALL: '⏰'
};

export default function RoomServicePage() {
  const { token } = useAuthStore();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  // New Request Form
  const [form, setForm] = useState({
    roomNumber: '',
    category: 'BREAKFAST',
    title: '',
    notes: ''
  });
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/hospitality/room-services', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load room service requests');
      const data = await res.json();
      setRequests(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [token]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!form.roomNumber || !form.title) {
      setFormError('Room number and request title are required');
      return;
    }

    try {
      const res = await fetch('/api/hospitality/room-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');

      setFormSuccess(`Service request created successfully!`);
      setForm({ roomNumber: '', category: 'BREAKFAST', title: '', notes: '' });
      fetchRequests();
    } catch (err: any) {
      setFormError(err.message || 'Error submitting request');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/hospitality/room-services/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Status update failed');
      fetchRequests();
    } catch (err: any) {
      console.error(err);
    }
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const accepted = requests.filter(r => r.status === 'ACCEPTED');
  const completed = requests.filter(r => r.status === 'COMPLETED');
  const cancelled = requests.filter(r => r.status === 'CANCELLED');

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="rounded-3xl border border-slate-200/60 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <Coffee className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-3xl font-black tracking-tight">Room Service Console</h2>
            <p className="text-sm text-slate-400">Track and dispatch in-room requests including breakfasts, laundry collections, housekeeping details, and wake-up timers.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_3.5fr]">
        
        {/* Creation Sidebar */}
        <form onSubmit={handleCreateRequest} className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm h-fit">
          <h3 className="font-extrabold text-slate-900 border-b border-slate-100 pb-2">New Service Ticket</h3>
          
          {formError && <div className="text-rose-600 text-xs font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-100">{formError}</div>}
          {formSuccess && <div className="text-emerald-600 text-xs font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">{formSuccess}</div>}

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Room Number</label>
            <input
              type="text"
              required
              placeholder="e.g. 101"
              value={form.roomNumber}
              onChange={e => setForm({ ...form, roomNumber: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Service Category</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-950 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            >
              <option value="BREAKFAST">🍳 Breakfast Order</option>
              <option value="LUNCH">🍔 Lunch Order</option>
              <option value="DINNER">🥩 Dinner Order</option>
              <option value="LAUNDRY">🧺 Laundry Service</option>
              <option value="CLEANING">🧹 Housekeeping</option>
              <option value="EXTRA_BED">🛏️ Extra Pillow/Bed</option>
              <option value="WAKE_UP_CALL">⏰ Wake Up Call</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Request Title</label>
            <input
              type="text"
              required
              placeholder="E.g., Two espresso shots, fresh linen"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Additional Instructions</label>
            <textarea
              placeholder="Special notes (optional)"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 h-20 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-950 hover:bg-slate-900 text-white font-black text-[10px] py-3 rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5" /> Send Request
          </button>
        </form>

        {/* Board Dashboard */}
        <div className="grid gap-4 md:grid-cols-4 items-start">
          
          {/* COLUMN: PENDING */}
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 space-y-3 shadow-inner min-h-[300px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending ({pending.length})
              </span>
            </div>
            
            <div className="space-y-3">
              {pending.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm hover:shadow transition">
                  <div className="flex items-start justify-between">
                    <span className="text-xl">{categoryIcons[item.category] || '📦'}</span>
                    <span className="text-[10px] font-black text-slate-950 bg-slate-100 px-2.5 py-1 rounded-xl">Room {item.roomNumber}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 leading-snug">{item.title}</h4>
                    {item.notes && <p className="text-[10px] text-slate-500 mt-1">{item.notes}</p>}
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'ACCEPTED')}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                      title="Accept Request"
                    >
                      <Play className="w-3 h-3" /> Accept
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'CANCELLED')}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black transition-all flex items-center"
                      title="Cancel Request"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COLUMN: ACCEPTED */}
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 space-y-3 shadow-inner min-h-[300px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Processing ({accepted.length})
              </span>
            </div>

            <div className="space-y-3">
              {accepted.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm hover:shadow transition">
                  <div className="flex items-start justify-between">
                    <span className="text-xl">{categoryIcons[item.category] || '📦'}</span>
                    <span className="text-[10px] font-black text-slate-950 bg-slate-100 px-2.5 py-1 rounded-xl">Room {item.roomNumber}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 leading-snug">{item.title}</h4>
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'COMPLETED')}
                      className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COLUMN: COMPLETED */}
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 space-y-3 shadow-inner min-h-[300px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed ({completed.length})
              </span>
            </div>

            <div className="space-y-3 opacity-80">
              {completed.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
                  <div className="flex items-start justify-between">
                    <span className="text-xl">{categoryIcons[item.category] || '📦'}</span>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-xl">Room {item.roomNumber}</span>
                  </div>
                  <h4 className="font-semibold text-xs text-slate-700 line-through">{item.title}</h4>
                </div>
              ))}
            </div>
          </div>

          {/* COLUMN: CANCELLED */}
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 space-y-3 shadow-inner min-h-[300px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Cancelled ({cancelled.length})
              </span>
            </div>

            <div className="space-y-3 opacity-60">
              {cancelled.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
                  <div className="flex items-start justify-between">
                    <span className="text-xl">{categoryIcons[item.category] || '📦'}</span>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-xl">Room {item.roomNumber}</span>
                  </div>
                  <h4 className="font-semibold text-xs text-slate-600 line-through">{item.title}</h4>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
