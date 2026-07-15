import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Star, Plus } from 'lucide-react';

interface BanquetBooking {
  id: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservationTime: string;
  estimatedCost: number;
  status: string;
  notes: string | null;
  creatorName: string;
}

interface BanquetPackageItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

export default function BanquetPage() {
  const { token } = useAuthStore();
  const [bookings, setBookings] = useState<BanquetBooking[]>([]);
  const [packages, setPackages] = useState<BanquetPackageItem[]>([]);
  
  // New Banquet booking form
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    packageId: '',
    partySize: 20,
    reservationTime: new Date().toISOString().slice(0, 16),
    notes: '',
    advancePaid: 500
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchBanquetDetails = async () => {
    try {
      const [bookingsRes, packagesRes] = await Promise.all([
        fetch('/api/hospitality/banquet/bookings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/hospitality/banquet/packages', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData);
      }
      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setPackages(packagesData);
        if (packagesData.length > 0 && !form.packageId) {
          setForm(prev => ({ ...prev, packageId: packagesData[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBanquetDetails();
  }, [token]);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const selectedPack = packages.find(p => p.id === form.packageId);
    if (!selectedPack) {
      setError('Invalid Banquet Package selected');
      setLoading(false);
      return;
    }

    if (form.partySize < 10) {
      setError('Banquet reservations require at least 10 guests');
      setLoading(false);
      return;
    }

    try {
      // Banquet reservation uses reservations endpoint under serviceType BANQUET_BOOKING
      const body = {
        serviceType: 'BANQUET_BOOKING',
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        partySize: form.partySize,
        reservationTime: form.reservationTime,
        notes: `${selectedPack.name} - ${form.notes}`,
        estimatedCost: selectedPack.price
      };

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Banquet booking failed');

      setSuccess(`Banquet hall event successfully scheduled! Total cost estimated: $${selectedPack.price.toFixed(2)}`);
      setForm({
        guestName: '',
        guestPhone: '',
        packageId: packages[0]?.id || '',
        partySize: 20,
        reservationTime: new Date().toISOString().slice(0, 16),
        notes: '',
        advancePaid: 500
      });
      fetchBanquetDetails();
    } catch (err: any) {
      setError(err.message || 'Error scheduling banquet event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Title Card */}
      <div className="rounded-3xl border border-slate-200/60 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <Star className="w-8 h-8 text-primary animate-pulse" />
          <div>
            <h2 className="text-3xl font-black tracking-tight">Banquet & Convention Halls</h2>
            <p className="text-sm text-slate-400">Organize premium banqueting, wedding ceremonies, executive business conferences, birthday galas, and catering bundles.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 p-4 text-xs font-bold shadow-sm">{error}</div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 p-4 text-xs font-bold shadow-sm">{success}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1.3fr]">
        
        {/* Reservation Booking Form */}
        <form onSubmit={handleSubmitBooking} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Plus className="w-5 h-5 text-slate-900" />
            <h3 className="font-extrabold text-lg text-slate-900">Schedule Banquet Event</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contact Person Name</label>
              <input
                type="text"
                required
                placeholder="Guest Name / Coordinator"
                value={form.guestName}
                onChange={e => setForm({ ...form, guestName: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Coordinator Phone</label>
              <input
                type="text"
                required
                placeholder="+1 (555) 000-0000"
                value={form.guestPhone}
                onChange={e => setForm({ ...form, guestPhone: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Banquet Package Tier</label>
              <select
                value={form.packageId}
                onChange={e => setForm({ ...form, packageId: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
              >
                {packages.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${p.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expected Guests Count (Min 10)</label>
              <input
                type="number"
                min={10}
                required
                value={form.partySize}
                onChange={e => setForm({ ...form, partySize: Number(e.target.value) })}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Event Date & Time</label>
              <input
                type="datetime-local"
                required
                value={form.reservationTime}
                onChange={e => setForm({ ...form, reservationTime: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Advance Deposit</label>
              <input
                type="number"
                required
                value={form.advancePaid}
                onChange={e => setForm({ ...form, advancePaid: Number(e.target.value) })}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Catering/Layout Requirements</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 h-20 resize-none"
              placeholder="E.g., Round table setup, vegetarian catering choice, microphone AV requirement"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-950 hover:bg-slate-900 text-white font-black text-xs py-4 rounded-2xl uppercase tracking-widest transition-all"
          >
            {loading ? 'Booking Banquet...' : 'Schedule Banquet Hall Booking'}
          </button>
        </form>

        {/* Board: Active Bookings & Packages Info */}
        <div className="space-y-6">
          {/* Packages info */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 border-b border-slate-100 pb-2">Banquet Packages Summary</h3>
            <div className="space-y-3">
              {packages.map(p => (
                <div key={p.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between gap-4 text-xs">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{p.name}</h4>
                    <p className="text-slate-500 mt-1">{p.description}</p>
                  </div>
                  <div className="text-right font-black text-slate-900 text-sm">
                    ${p.price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Banquet Timeline */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 border-b border-slate-100 pb-2">Event Availability Calendar</h3>
            {bookings.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs font-semibold">No banquet events scheduled yet.</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {bookings.map(booking => (
                  <div key={booking.id} className="p-4 border border-slate-100 rounded-2xl space-y-3 hover:shadow-sm transition">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{booking.guestName}</div>
                        <div className="text-slate-500 mt-1">{new Date(booking.reservationTime).toLocaleString()}</div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-700 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase">
                        {booking.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-2.5 rounded-xl">
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Guests Size</span>
                        <span className="font-bold text-slate-800">{booking.partySize} guests</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Est. Value</span>
                        <span className="font-bold text-slate-800">${booking.estimatedCost.toFixed(2)}</span>
                      </div>
                    </div>
                    {booking.notes && (
                      <p className="text-[10px] text-slate-500 italic bg-slate-50/50 p-2 rounded-xl">
                        Notes: {booking.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
