import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { LogIn, LogOut, Users, CreditCard, ChevronRight, Calculator } from 'lucide-react';
import InvoiceDetail from '../components/InvoiceDetail';

interface RoomItem {
  id: string;
  number: string;
  status: string;
  roomType: { id: string; name: string; nightlyRate: number };
}

interface BookingItem {
  id: string;
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rate: number;
  discount: number;
  gst: number;
  advancePaid: number;
  remainingAmount: number;
  guest: { fullName: string; phone: string; email: string; idProof: string; nationality: string };
  room: { number: string; status: string };
  roomType: { name: string };
}

export default function CheckInOutPage() {
  const { token } = useAuthStore();
  
  // Data lists
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [activeStays, setActiveStays] = useState<BookingItem[]>([]);
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'checkin' | 'checkout'>('checkin');

  // Check In form state
  const [checkInForm, setCheckInForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    idProof: '',
    nationality: '',
    adults: 2,
    children: 0,
    roomId: '',
    roomTypeId: '',
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    rate: 0,
    discount: 0,
    gst: 18, // default tax percent or value
    advancePaid: 0,
    specialRequest: ''
  });

  // Check Out modal/drawer state
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [checkOutCharges, setCheckOutCharges] = useState({
    lateCheckOutFee: 0,
    miniBarCharges: 0,
    laundryCharges: 0,
    restaurantCharges: 0,
    cafeCharges: 0,
    barCharges: 0,
    roomServiceCharges: 0,
    discount: 0,
    paymentMethod: 'CREDIT_CARD'
  });

  // Invoice display modal state
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/hotel/rooms', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActiveStays = async () => {
    try {
      const res = await fetch('/api/hotel/bookings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setActiveStays(data.filter((b: BookingItem) => b.status === 'CHECKED_IN'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchActiveStays();
  }, [token]);

  // Sync Room Type Rate when selecting a room
  const handleRoomChange = (roomId: string) => {
    const selectedRoom = rooms.find(r => r.id === roomId);
    if (selectedRoom) {
      setCheckInForm(prev => ({
        ...prev,
        roomId,
        roomTypeId: selectedRoom.roomType.id,
        rate: selectedRoom.roomType.nightlyRate
      }));
    }
  };

  // Perform Check In
  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const gstAmount = Number(((checkInForm.rate * 0.18) * 1).toFixed(2)); // mock GST
      const body = {
        ...checkInForm,
        gst: gstAmount
      };

      const res = await fetch('/api/hospitality/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');

      setSuccess(`Check-in registered successfully! Guest has been assigned Room ${rooms.find(r => r.id === checkInForm.roomId)?.number}`);
      setCheckInForm({
        guestName: '',
        guestPhone: '',
        guestEmail: '',
        idProof: '',
        nationality: '',
        adults: 2,
        children: 0,
        roomId: '',
        roomTypeId: '',
        checkIn: new Date().toISOString().slice(0, 10),
        checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        rate: 0,
        discount: 0,
        gst: 18,
        advancePaid: 0,
        specialRequest: ''
      });
      fetchRooms();
      fetchActiveStays();
    } catch (err: any) {
      setError(err.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  // Perform Check Out
  const handleCheckOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/hospitality/bookings/${selectedBooking.id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(checkOutCharges)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-out failed');

      setInvoiceData({
        booking: selectedBooking,
        breakdown: data.breakdown
      });
      setShowInvoice(true);
      setSuccess(`Checked out successfully! Final bill calculated: $${data.breakdown.grandTotal.toFixed(2)}`);
      setSelectedBooking(null);
      setCheckOutCharges({
        lateCheckOutFee: 0,
        miniBarCharges: 0,
        laundryCharges: 0,
        restaurantCharges: 0,
        cafeCharges: 0,
        barCharges: 0,
        roomServiceCharges: 0,
        discount: 0,
        paymentMethod: 'CREDIT_CARD'
      });
      fetchRooms();
      fetchActiveStays();
    } catch (err: any) {
      setError(err.message || 'Check-out failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Panel */}
      <div className="rounded-3xl border border-slate-200/60 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">Frontdesk Check In & Out Terminal</h2>
            <p className="text-sm text-slate-400">Streamlined booking desk. Manage live arrivals, verify guest documentation, calculate late stay fees, and generate billing reports.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('checkin')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'checkin' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              <LogIn className="w-4 h-4" /> Guest Check-In
            </button>
            <button
              onClick={() => setActiveTab('checkout')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'checkout' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              <LogOut className="w-4 h-4" /> Guest Check-Out ({activeStays.length})
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 p-4 text-xs font-bold shadow-sm">{error}</div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 p-4 text-xs font-bold shadow-sm">{success}</div>
      )}

      {/* Primary Panels */}
      {activeTab === 'checkin' ? (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          {/* Check In Form */}
          <form onSubmit={handleCheckInSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <LogIn className="w-5 h-5 text-slate-900" />
              <h3 className="font-extrabold text-lg text-slate-900">New Guest Registration</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Guest Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={checkInForm.guestName}
                  onChange={e => setCheckInForm({ ...checkInForm, guestName: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone</label>
                <input
                  type="text"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={checkInForm.guestPhone}
                  onChange={e => setCheckInForm({ ...checkInForm, guestPhone: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email</label>
                <input
                  type="email"
                  required
                  placeholder="guest@domain.com"
                  value={checkInForm.guestEmail}
                  onChange={e => setCheckInForm({ ...checkInForm, guestEmail: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">ID Proof Document</label>
                <input
                  type="text"
                  required
                  placeholder="Passport / Driver License No"
                  value={checkInForm.idProof}
                  onChange={e => setCheckInForm({ ...checkInForm, idProof: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nationality</label>
                <input
                  type="text"
                  required
                  placeholder="Nationality"
                  value={checkInForm.nationality}
                  onChange={e => setCheckInForm({ ...checkInForm, nationality: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Adults Count</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={checkInForm.adults}
                  onChange={e => setCheckInForm({ ...checkInForm, adults: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Children Count</label>
                <input
                  type="number"
                  min={0}
                  value={checkInForm.children}
                  onChange={e => setCheckInForm({ ...checkInForm, children: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Room Number</label>
                <select
                  required
                  value={checkInForm.roomId}
                  onChange={e => handleRoomChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
                >
                  <option value="">Choose an available room</option>
                  {rooms.filter(r => r.status === 'AVAILABLE').map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.number} - {r.roomType.name} (${r.roomType.nightlyRate}/night)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Check In Date</label>
                <input
                  type="date"
                  required
                  value={checkInForm.checkIn}
                  onChange={e => setCheckInForm({ ...checkInForm, checkIn: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Check Out Date</label>
                <input
                  type="date"
                  required
                  value={checkInForm.checkOut}
                  onChange={e => setCheckInForm({ ...checkInForm, checkOut: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nightly Rate</label>
                <input
                  type="number"
                  required
                  value={checkInForm.rate}
                  onChange={e => setCheckInForm({ ...checkInForm, rate: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Advance Paid</label>
                <input
                  type="number"
                  value={checkInForm.advancePaid}
                  onChange={e => setCheckInForm({ ...checkInForm, advancePaid: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Special Request / Notes</label>
              <textarea
                value={checkInForm.specialRequest}
                onChange={e => setCheckInForm({ ...checkInForm, specialRequest: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 h-20 resize-none"
                placeholder="E.g., high floor, extra bed, early check-in"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black text-xs py-4 rounded-2xl uppercase tracking-widest transition-all"
            >
              {loading ? 'Registering...' : 'Register Guest check-in'}
            </button>
          </form>

          {/* Quick Rooms occupancy dashboard */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 space-y-6 flex flex-col justify-between border border-slate-800 shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-lg text-white">Live Room Matrix</h3>
              </div>
              
              <div className="grid grid-cols-4 gap-3">
                {rooms.map(r => {
                  let statusBg = 'bg-slate-800 border-slate-700 text-slate-400';
                  if (r.status === 'AVAILABLE') statusBg = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400';
                  else if (r.status === 'OCCUPIED') statusBg = 'bg-rose-500/10 border-rose-500/40 text-rose-400';
                  else if (r.status === 'RESERVED') statusBg = 'bg-amber-500/10 border-amber-500/40 text-amber-400';
                  else if (r.status === 'CLEANING') statusBg = 'bg-blue-500/10 border-blue-500/40 text-blue-400';
                  
                  return (
                    <div key={r.id} className={`p-3 rounded-2xl border text-center font-bold text-xs ${statusBg}`}>
                      <div className="font-black text-base">{r.number}</div>
                      <div className="text-[8px] uppercase tracking-wider font-semibold opacity-70 mt-1">{r.status}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 mt-6">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Checkout Rates Info</h4>
              <p className="text-xs text-slate-400 leading-normal">
                Standard check-in registers the stay state instantly in the system. Check-out dynamically aggregates POS transactions (Cafe, Restaurant, Bar) and logs automated room status updates to 'CLEANING'.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* CHECK OUT INTERFACE */
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          {/* List of checked in stays */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <LogOut className="w-5 h-5 text-slate-900" />
              <h3 className="font-extrabold text-lg text-slate-900">Current Occupancy Stays</h3>
            </div>

            {activeStays.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No guests currently checked in.</div>
            ) : (
              <div className="space-y-3">
                {activeStays.map(stay => (
                  <button
                    key={stay.id}
                    onClick={() => setSelectedBooking(stay)}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      selectedBooking?.id === stay.id
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                        : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{stay.guest.fullName}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Room <strong className="text-slate-800">{stay.room.number}</strong> · {stay.roomType.name}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${selectedBooking?.id === stay.id ? 'rotate-90 text-primary' : ''}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Checkout billing calculator */}
          {selectedBooking ? (
            <form onSubmit={handleCheckOutSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4 justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-slate-900" />
                  <h3 className="font-extrabold text-lg text-slate-900">Stay Settlement Desk</h3>
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-xl">
                  {selectedBooking.bookingNumber}
                </span>
              </div>

              {/* Guest details summary */}
              <div className="p-4 bg-slate-50 rounded-2xl grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-slate-400 font-bold uppercase tracking-wider text-[9px]">Guest Name</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedBooking.guest.fullName}</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-bold uppercase tracking-wider text-[9px]">Room Number</span>
                  <span className="font-bold text-slate-800 text-sm">Room {selectedBooking.room.number}</span>
                </div>
              </div>

              {/* Extra charge inputs */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Additional Billable Items</h4>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Late Checkout Fee</label>
                    <input
                      type="number"
                      min={0}
                      value={checkOutCharges.lateCheckOutFee}
                      onChange={e => setCheckOutCharges({ ...checkOutCharges, lateCheckOutFee: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mini Bar Charge</label>
                    <input
                      type="number"
                      min={0}
                      value={checkOutCharges.miniBarCharges}
                      onChange={e => setCheckOutCharges({ ...checkOutCharges, miniBarCharges: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Laundry</label>
                    <input
                      type="number"
                      min={0}
                      value={checkOutCharges.laundryCharges}
                      onChange={e => setCheckOutCharges({ ...checkOutCharges, laundryCharges: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Restaurant</label>
                    <input
                      type="number"
                      min={0}
                      value={checkOutCharges.restaurantCharges}
                      onChange={e => setCheckOutCharges({ ...checkOutCharges, restaurantCharges: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cafe Orders</label>
                    <input
                      type="number"
                      min={0}
                      value={checkOutCharges.cafeCharges}
                      onChange={e => setCheckOutCharges({ ...checkOutCharges, cafeCharges: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bar Lounge Bill</label>
                    <input
                      type="number"
                      min={0}
                      value={checkOutCharges.barCharges}
                      onChange={e => setCheckOutCharges({ ...checkOutCharges, barCharges: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Room Service</label>
                    <input
                      type="number"
                      min={0}
                      value={checkOutCharges.roomServiceCharges}
                      onChange={e => setCheckOutCharges({ ...checkOutCharges, roomServiceCharges: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Additional Discount</label>
                    <input
                      type="number"
                      min={0}
                      value={checkOutCharges.discount}
                      onChange={e => setCheckOutCharges({ ...checkOutCharges, discount: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 text-rose-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Settlement Method</label>
                  <select
                    value={checkOutCharges.paymentMethod}
                    onChange={e => setCheckOutCharges({ ...checkOutCharges, paymentMethod: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
                  >
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="UPI_QR">UPI / QR Scan</option>
                    <option value="CASH">Cash Payment</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 text-white font-black text-xs py-4 rounded-2xl uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{loading ? 'Processing...' : 'Settle Bill & Check-Out'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-slate-50 border border-slate-100 border-dashed rounded-3xl p-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <LogOut className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-semibold">Select a staying guest to begin stay settlement calculations.</p>
            </div>
          )}
        </div>
      )}

      {/* Invoice Receipt Modal */}
      {showInvoice && invoiceData && (
        <InvoiceDetail
          isOpen={showInvoice}
          onClose={() => setShowInvoice(false)}
          booking={invoiceData.booking}
          breakdown={invoiceData.breakdown}
        />
      )}

    </div>
  );
}
