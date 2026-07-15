import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Plus, ClipboardList, DollarSign } from 'lucide-react';

interface RoomTypeItem {
  id: string;
  name: string;
  nightlyRate: number;
}

interface RoomItem {
  id: string;
  number: string;
  status: string;
  roomType: { id: string; name: string };
}

interface BookingItem {
  id: string;
  bookingNumber: string;
  guest: { fullName: string };
  room: { number: string };
  roomType: { name: string };
  status: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  total: number;
}

export default function HotelBookingsPage() {
  const { token } = useAuthStore();
  const [roomTypes, setRoomTypes] = useState<RoomTypeItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    idProof: '',
    nationality: '',
    adults: 2,
    children: 0,
    roomTypeId: '',
    roomId: '',
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().slice(0, 10),
    rate: 0,
    discount: 0,
    gst: 0,
    advancePaid: 0,
    specialRequest: ''
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculateNights = useMemo(() => {
    const checkIn = new Date(form.checkIn);
    const checkOut = new Date(form.checkOut);
    const delta = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    return delta > 0 ? delta : 1;
  }, [form.checkIn, form.checkOut]);

  const total = useMemo(() => {
    const base = form.rate * calculateNights;
    return Number((base - form.discount + form.gst).toFixed(2));
  }, [form.rate, calculateNights, form.discount, form.gst]);

  const remaining = useMemo(() => {
    return Number((total - form.advancePaid).toFixed(2));
  }, [total, form.advancePaid]);

  const loadData = async () => {
    setErrorMessage(null);
    try {
      const [typesRes, roomsRes, bookingsRes] = await Promise.all([
        fetch('/api/hotel/room-types', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/hotel/rooms', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/hotel/bookings', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (!typesRes.ok || !roomsRes.ok || !bookingsRes.ok) {
        throw new Error('Failed to load booking resources');
      }

      const [typesData, roomsData, bookingsData] = await Promise.all([typesRes.json(), roomsRes.json(), bookingsRes.json()]);
      setRoomTypes(typesData);
      setRooms(roomsData.filter((room: RoomItem) => room.status === 'AVAILABLE' || room.status === 'RESERVED'));
      setBookings(bookingsData);
      if (!form.roomTypeId && typesData.length > 0) {
        setForm((prev) => ({ ...prev, roomTypeId: typesData[0].id, rate: typesData[0].nightlyRate }));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load booking page data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const selectedType = roomTypes.find((type) => type.id === form.roomTypeId);
    if (selectedType) {
      setForm((prev) => ({ ...prev, rate: selectedType.nightlyRate }));
    }
  }, [form.roomTypeId, roomTypes]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/hotel/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Booking creation failed');
      }
      setStatusMessage('Booking created successfully with number ' + data.bookingNumber);
      setForm((prev) => ({ ...prev, guestName: '', guestPhone: '', guestEmail: '', idProof: '', nationality: '', specialRequest: '' }));
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Room Booking Studio</h2>
            <p className="text-sm text-slate-300">Create and manage hotel room reservations with guest details, pricing, and invoice readiness.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl bg-white/10 px-4 py-3 text-sm text-slate-200">
            <Plus className="w-4 h-4" /> Live booking creation
          </div>
        </div>
      </div>

      {errorMessage && <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{errorMessage}</div>}
      {statusMessage && <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{statusMessage}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Guest Name</label>
              <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="Guest full name" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone</label>
              <input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="+1 555 000 0000" required />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email</label>
              <input value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="guest@example.com" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">ID Proof</label>
              <input value={form.idProof} onChange={(e) => setForm({ ...form, idProof: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="Passport or driver license" required />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nationality</label>
              <input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="Nationality" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Adults</label>
              <input type="number" min={1} value={form.adults} onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Children</label>
              <input type="number" min={0} value={form.children} onChange={(e) => setForm({ ...form, children: Number(e.target.value) })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Room Type</label>
              <select value={form.roomTypeId} onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" required>
                {roomTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Room Number</label>
              <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" required>
                <option value="">Select available room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.number} — {room.roomType?.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Check In</label>
              <input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" required />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Check Out</label>
              <input type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rate</label>
              <input type="number" min={0} step={0.01} value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Discount</label>
              <input type="number" min={0} step={0.01} value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">GST</label>
              <input type="number" min={0} step={0.01} value={form.gst} onChange={(e) => setForm({ ...form, gst: Number(e.target.value) })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Advance Paid</label>
              <input type="number" min={0} step={0.01} value={form.advancePaid} onChange={(e) => setForm({ ...form, advancePaid: Number(e.target.value) })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Special Request</label>
              <input value={form.specialRequest} onChange={(e) => setForm({ ...form, specialRequest: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="Late checkout, extra pillows" />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 p-4 text-sm text-slate-700">
              <div className="font-black text-slate-900">Nights</div>
              <div className="mt-3 text-3xl font-extrabold">{calculateNights}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 p-4 text-sm text-slate-700">
              <div className="font-black text-slate-900">Booking Total</div>
              <div className="mt-3 text-3xl font-extrabold">${total.toFixed(2)}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 p-4 text-sm text-slate-700">
              <div className="font-black text-slate-900">Remaining</div>
              <div className="mt-3 text-3xl font-extrabold">${remaining.toFixed(2)}</div>
            </div>
            <button type="submit" disabled={isSubmitting} className="rounded-3xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {isSubmitting ? 'Booking...' : 'Create Booking'}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Recent Stays</p>
              <h3 className="text-2xl font-extrabold text-slate-900">Current booking pipeline</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-3xl bg-slate-100 px-4 py-2 text-sm text-slate-700">
              <ClipboardList className="w-4 h-4" /> {bookings.length} total
            </div>
          </div>

          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No bookings found yet.</div>
            ) : bookings.map((booking) => (
              <div key={booking.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm transition hover:shadow-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm text-slate-500">{booking.bookingNumber}</div>
                    <div className="mt-2 text-lg font-bold text-slate-900">{booking.guest.fullName}</div>
                    <div className="mt-1 text-sm text-slate-500">Room {booking.room.number} · {booking.roomType.name}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-700">{booking.status.replace('_', ' ')}</span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">{booking.paymentStatus}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">Check-in: {new Date(booking.checkIn).toLocaleDateString()}</div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">Check-out: {new Date(booking.checkOut).toLocaleDateString()}</div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <DollarSign className="w-4 h-4" /> Total: ${booking.total.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
