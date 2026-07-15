import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Building, Calendar, Clock, DollarSign, Users } from 'lucide-react';

interface DashboardData {
  roomCounts: {
    available: number;
    occupied: number;
    reserved: number;
    cleaning: number;
    maintenance: number;
    blocked: number;
  };
  expectedArrivals: number;
  expectedDepartures: number;
  revenue: number;
  pendingPayments: number;
  roomServiceRequests: number;
  latestBookings: Array<{ id: string; bookingNumber: string; status: string; roomId: string; checkIn: string; checkOut: string; total: number }>;
}

const statCards = [
  { key: 'available', label: 'Available Rooms', icon: Building, color: 'bg-emerald-500/10 text-emerald-500' },
  { key: 'occupied', label: 'Occupied Rooms', icon: Clock, color: 'bg-rose-500/10 text-rose-500' },
  { key: 'reserved', label: 'Reserved Rooms', icon: Calendar, color: 'bg-amber-500/10 text-amber-500' },
  { key: 'pendingPayments', label: 'Pending Payments', icon: DollarSign, color: 'bg-sky-500/10 text-sky-500' }
];

export default function HotelDashboardPage() {
  const { token, user } = useAuthStore();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/hotel/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Unable to load dashboard');
      }
      const data = await response.json();
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load hotel dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-yellow-300/20 bg-gradient-to-r from-yellow-50 via-white to-amber-50 p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-3">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Hotel Operations Hub</h2>
            <p className="text-sm text-slate-600 max-w-2xl">A premium hotel management panorama for reservations, housekeeping, room service, and billing.</p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-3xl bg-white/80 px-5 py-4 shadow-sm border border-yellow-200">
            <Users className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Signed in as</div>
              <div className="font-bold text-slate-900">{user?.name}</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-40 rounded-3xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
      ) : dashboard ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              const value = card.key === 'pendingPayments' ? dashboard.pendingPayments : (dashboard.roomCounts as any)[card.key];
              return (
                <motion.div
                  key={card.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  className={`rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-400">{card.label}</div>
                      <div className="mt-4 text-3xl font-extrabold text-slate-900">{value}</div>
                    </div>
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200/80 bg-slate-950/95 p-6 text-white shadow-xl">
              <h3 className="text-lg font-bold">Today's Arrivals</h3>
              <p className="mt-3 text-4xl font-extrabold">{dashboard.expectedArrivals}</p>
              <p className="mt-2 text-sm text-slate-300">Room arrivals scheduled for today.</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-blue-950/95 p-6 text-white shadow-xl">
              <h3 className="text-lg font-bold">Today's Departures</h3>
              <p className="mt-3 text-4xl font-extrabold">{dashboard.expectedDepartures}</p>
              <p className="mt-2 text-sm text-slate-300">Guests checking out before midnight.</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-rose-950/95 p-6 text-white shadow-xl">
              <h3 className="text-lg font-bold">Service Requests</h3>
              <p className="mt-3 text-4xl font-extrabold">{dashboard.roomServiceRequests}</p>
              <p className="mt-2 text-sm text-slate-300">Pending room service tasks awaiting acceptance.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-bold">Latest Bookings</h3>
                <p className="text-sm text-slate-500">Most recent stay plans and room assignments.</p>
              </div>
              <button onClick={fetchDashboard} className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800">
                Refresh
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {dashboard.latestBookings.map((booking) => (
                <div key={booking.id} className="rounded-3xl border border-slate-200/80 p-4 hover:shadow-lg transition">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-900">{booking.bookingNumber}</p>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase text-amber-700">{booking.status.replace('_', ' ')}</span>
                  </div>
                  <p className="mt-4 text-sm text-slate-500">Room: {booking.roomId}</p>
                  <p className="mt-2 text-sm text-slate-500">Check-in: {new Date(booking.checkIn).toLocaleDateString()}</p>
                  <p className="mt-1 text-sm text-slate-500">Check-out: {new Date(booking.checkOut).toLocaleDateString()}</p>
                  <p className="mt-4 text-sm font-bold text-slate-900">Total: ${booking.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
