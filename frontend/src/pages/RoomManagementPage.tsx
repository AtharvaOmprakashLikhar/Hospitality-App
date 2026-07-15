import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Sparkles, 
  List, 
  Grid,
  User,
  Activity,
  FileText,
  Printer
} from 'lucide-react';

interface Room {
  id: string;
  number: string;
  name: string;
  floorId: string;
  floorName: string;
  roomTypeId: string;
  roomTypeName: string;
  category: string;
  capacity: number;
  bedType: string;
  basePrice: number;
  weekendPrice: number | null;
  seasonalPrice: number | null;
  gst: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'MAINTENANCE' | 'BLOCKED';
  description: string;
  amenities: string[];
  images: string[];
  assignedGuest: string | null;
  bookingNumber: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  housekeepingStaff: string | null;
  maintenanceIssue: string | null;
  maintenancePriority: string | null;
  lastUpdated: string;
}

interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  reservedRooms: number;
  roomsBeingCleaned: number;
  roomsUnderMaintenance: number;
  checkinsToday: number;
  checkoutsToday: number;
  occupancyPercentage: number;
  revenuePerAvailableRoom: number;
}

interface Suggestion {
  roomId: string;
  roomNumber: string;
  price: number;
  status: string;
  reason: string;
}

interface TimelineItem {
  roomId: string;
  roomNumber: string;
  status: string;
  timeline: Array<{
    bookingId: string;
    bookingNumber: string;
    status: string;
    checkIn: string;
    checkOut: string;
  }>;
}

export default function RoomManagementPage() {
  const { token } = useAuthStore();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Operations state
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [bookingHistory, setBookingHistory] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form states
  const [form, setForm] = useState({
    number: '',
    name: '',
    floorId: '',
    roomTypeId: '',
    category: '',
    capacity: 2,
    bedType: 'King size bed',
    basePrice: 100,
    weekendPrice: '',
    seasonalPrice: '',
    gst: 18,
    description: '',
    amenities: '',
    status: 'AVAILABLE'
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [roomsRes, statsRes, timelineRes, floorsRes, typesRes] = await Promise.all([
        fetch(`/api/rooms?search=${search}&status=${filterStatus}&floorId=${filterFloor}`, { headers }),
        fetch('/api/rooms/dashboard', { headers }),
        fetch('/api/rooms/availability', { headers }),
        fetch('/api/hotel/floors', { headers }),
        fetch('/api/hotel/room-types', { headers })
      ]);

      if (roomsRes.ok) setRooms(await roomsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (timelineRes.ok) setTimeline(await timelineRes.json());
      if (floorsRes.ok) setFloors(await floorsRes.json());
      if (typesRes.ok) setRoomTypes(await typesRes.json());

    } catch (err: any) {
      setError(err.message || 'Failed to fetch rooms metadata.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, filterStatus, filterFloor]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create room');
      }
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    try {
      const res = await fetch(`/api/rooms/${activeRoom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update room');
      }
      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/rooms/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId, status: newStatus })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerSuggestions = (room: Room) => {
    // Smart Room Suggestions Algorithm
    const filtered = rooms.filter(r => r.id !== room.id && r.status === 'AVAILABLE');
    const list: Suggestion[] = [];

    // 1. Same Floor
    const sameFloor = filtered.find(r => r.floorId === room.floorId);
    if (sameFloor) list.push({ roomId: sameFloor.id, roomNumber: sameFloor.number, price: sameFloor.basePrice, status: sameFloor.status, reason: `Same Floor (${room.floorName})` });

    // 2. Same Price Range (+/- 20%)
    const samePrice = filtered.find(r => Math.abs(r.basePrice - room.basePrice) <= room.basePrice * 0.2);
    if (samePrice && !list.find(l => l.roomId === samePrice.id)) {
      list.push({ roomId: samePrice.id, roomNumber: samePrice.number, price: samePrice.basePrice, status: samePrice.status, reason: `Similar Price ($${samePrice.basePrice}/night)` });
    }

    // 3. Similar Room Type
    const sameType = filtered.find(r => r.roomTypeId === room.roomTypeId);
    if (sameType && !list.find(l => l.roomId === sameType.id)) {
      list.push({ roomId: sameType.id, roomNumber: sameType.number, price: sameType.basePrice, status: sameType.status, reason: `Same Room Type (${room.roomTypeName})` });
    }

    // 4. Higher Category
    const higherCategory = filtered.find(r => r.basePrice > room.basePrice);
    if (higherCategory && !list.find(l => l.roomId === higherCategory.id)) {
      list.push({ roomId: higherCategory.id, roomNumber: higherCategory.number, price: higherCategory.basePrice, status: higherCategory.status, reason: `Higher Premium Category (${higherCategory.category})` });
    }

    setSuggestions(list.slice(0, 4));
    setActiveRoom(room);
    setShowSuggestionsModal(true);
  };

  const viewHistory = async (room: Room) => {
    try {
      const res = await fetch(`/api/rooms/history?roomId=${room.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBookingHistory(await res.json());
        setActiveRoom(room);
        setShowHistoryModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openCreateModal = () => {
    setForm({
      number: '',
      name: '',
      floorId: floors[0]?.id || '',
      roomTypeId: roomTypes[0]?.id || '',
      category: roomTypes[0]?.name || '',
      capacity: 2,
      bedType: 'King size bed',
      basePrice: 100,
      weekendPrice: '',
      seasonalPrice: '',
      gst: 18,
      description: '',
      amenities: 'Free WiFi, AC, TV, Mini Bar, Safe',
      status: 'AVAILABLE'
    });
    setShowCreateModal(true);
  };

  const openEditModal = (room: Room) => {
    setActiveRoom(room);
    setForm({
      number: room.number,
      name: room.name,
      floorId: room.floorId,
      roomTypeId: room.roomTypeId,
      category: room.category,
      capacity: room.capacity,
      bedType: room.bedType,
      basePrice: room.basePrice,
      weekendPrice: room.weekendPrice ? String(room.weekendPrice) : '',
      seasonalPrice: room.seasonalPrice ? String(room.seasonalPrice) : '',
      gst: room.gst,
      description: room.description,
      amenities: room.amenities.join(', '),
      status: room.status
    });
    setShowEditModal(true);
  };

  const printRoomDetails = (room: Room) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Room Details - ${room.number}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; color: #333; }
              h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
              .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; }
              .detail-item { font-size: 14px; }
              .detail-item strong { display: block; color: #666; margin-bottom: 5px; }
            </style>
          </head>
          <body>
            <h1>Room ${room.number} Details</h1>
            <div class="detail-grid">
              <div class="detail-item"><strong>Room Name</strong>${room.name}</div>
              <div class="detail-item"><strong>Floor</strong>${room.floorName}</div>
              <div class="detail-item"><strong>Category</strong>${room.category}</div>
              <div class="detail-item"><strong>Price per Night</strong>$${room.basePrice.toFixed(2)}</div>
              <div class="detail-item"><strong>GST</strong>${room.gst}%</div>
              <div class="detail-item"><strong>Status</strong>${room.status}</div>
              <div class="detail-item"><strong>Capacity</strong>${room.capacity} Guests</div>
              <div class="detail-item"><strong>Bed Type</strong>${room.bedType}</div>
            </div>
            <p style="margin-top: 40px;"><strong>Amenities:</strong> ${room.amenities.join(', ')}</p>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const statusColors: Record<string, string> = {
    AVAILABLE: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    OCCUPIED: 'bg-rose-100 text-rose-700 border-rose-300',
    RESERVED: 'bg-amber-100 text-amber-700 border-amber-300',
    CLEANING: 'bg-sky-100 text-sky-700 border-sky-300',
    MAINTENANCE: 'bg-purple-100 text-purple-700 border-purple-300',
    BLOCKED: 'bg-stone-200 text-stone-700 border-stone-400'
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-3xl text-xs">{error}</div>
      )}
      
      {/* Dashboard Statistics Header */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Total Rooms</span>
            <span className="mt-2 text-2xl font-black block text-slate-900">{stats.totalRooms}</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Rooms registered</span>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
            <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-600">Available Rooms</span>
            <span className="mt-2 text-2xl font-black block text-emerald-800">{stats.availableRooms}</span>
            <span className="text-[10px] text-emerald-600 mt-1 block">Ready for guest stay</span>
          </div>
          <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
            <span className="block text-[10px] font-black uppercase tracking-widest text-rose-600">Occupied Rooms</span>
            <span className="mt-2 text-2xl font-black block text-rose-800">{stats.occupiedRooms}</span>
            <span className="text-[10px] text-rose-600 mt-1 block">Guests checked in</span>
          </div>
          <div className="rounded-3xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
            <span className="block text-[10px] font-black uppercase tracking-widest text-sky-600">Cleaning / Fixes</span>
            <span className="mt-2 text-2xl font-black block text-sky-800">{stats.roomsBeingCleaned + stats.roomsUnderMaintenance}</span>
            <span className="text-[10px] text-sky-600 mt-1 block">Housekeeping logs</span>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
            <span className="block text-[10px] font-black uppercase tracking-widest text-amber-600">Today Check In/Out</span>
            <span className="mt-2 text-xl font-black block text-amber-800">{stats.checkinsToday} In · {stats.checkoutsToday} Out</span>
            <span className="text-[10px] text-amber-600 mt-1 block">Occupancy: {stats.occupancyPercentage}%</span>
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search room no or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-900"
            />
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-2xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="OCCUPIED">OCCUPIED</option>
            <option value="RESERVED">RESERVED</option>
            <option value="CLEANING">CLEANING</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
          </select>

          <select
            value={filterFloor}
            onChange={e => setFilterFloor(e.target.value)}
            className="px-3 py-2.5 rounded-2xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="">All Floors</option>
            {floors.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
            title="Toggle View Mode"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
          
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Room
          </button>
        </div>
      </div>

      {/* Visual availability timeline track */}
      {timeline.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4">
          <div>
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" /> Room Occupancy Timeline Desk
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Real-time booking and reservation schedules timeline for next 48 hours.</p>
          </div>

          <div className="space-y-3 max-h-48 overflow-y-auto divide-y divide-slate-800">
            {timeline.map(item => (
              <div key={item.roomId} className="pt-2 flex items-center justify-between text-xs">
                <span className="font-black text-slate-300 w-24">Room {item.roomNumber}</span>
                <div className="flex-1 flex gap-1.5 overflow-x-auto px-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    item.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {item.status}
                  </span>
                  {item.timeline.map(b => (
                    <span key={b.bookingId} className="px-2 py-0.5 rounded text-[9px] bg-slate-800 border border-slate-700 text-slate-300">
                      {b.bookingNumber} ({new Date(b.checkIn).toLocaleDateString()})
                    </span>
                  ))}
                  {item.timeline.length === 0 && (
                    <span className="text-[9px] text-slate-500 italic">No bookings scheduled</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room list output */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-60 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white border rounded-3xl p-12 text-center text-slate-400 text-xs">No rooms found. Try adjusting filter scopes.</div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => (
            <div key={room.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition duration-300">
              
              {/* Header card */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-black text-slate-900 text-base">{room.name}</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{room.floorName} · {room.category}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border ${statusColors[room.status] || ''}`}>
                  {room.status}
                </span>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Nightly Price</span>
                  <span className="font-extrabold text-slate-800">${room.basePrice.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Capacity / Bed</span>
                  <span className="font-extrabold text-slate-800">{room.capacity} Pax · {room.bedType}</span>
                </div>
              </div>

              {/* Occupancy specifics */}
              {room.status === 'OCCUPIED' && room.assignedGuest && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-900 rounded-2xl text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1"><User className="w-3.5 h-3.5 text-rose-500" /> Guest: {room.assignedGuest}</div>
                  <div>In: {new Date(room.checkInDate || '').toLocaleDateString()} · Out: {new Date(room.checkOutDate || '').toLocaleDateString()}</div>
                </div>
              )}

              {room.status === 'RESERVED' && (
                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl text-[11px] space-y-1">
                  <div className="font-bold">Reserved Booking Desk</div>
                  <div>Arrival: {new Date(room.checkInDate || '').toLocaleDateString()}</div>
                </div>
              )}

              {room.status === 'CLEANING' && (
                <div className="p-3 bg-sky-50 border border-sky-100 text-sky-900 rounded-2xl text-[11px] space-y-1">
                  <div className="font-bold">Housekeeping Clean Task</div>
                  <div>Staff Assigned: {room.housekeepingStaff || 'Unassigned'}</div>
                </div>
              )}

              {room.status === 'MAINTENANCE' && (
                <div className="p-3 bg-purple-50 border border-purple-100 text-purple-900 rounded-2xl text-[11px] space-y-1">
                  <div className="font-bold">Maintenance Issue Reported</div>
                  <div>Issue: {room.maintenanceIssue || 'AC Inspection'} · Priority: {room.maintenancePriority}</div>
                </div>
              )}

              {/* Actions panel */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(room)}
                  className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border text-slate-600"
                  title="Edit Room Specs"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => printRoomDetails(room)}
                  className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border text-slate-600"
                  title="Print Slip"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => viewHistory(room)}
                  className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border text-slate-600"
                  title="Booking History"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                {room.status !== 'AVAILABLE' && (
                  <button
                    onClick={() => triggerSuggestions(room)}
                    className="px-3 py-1 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                    title="Suggestions"
                  >
                    <Sparkles className="w-3 h-3" /> Suggestion
                  </button>
                )}
                {room.status === 'AVAILABLE' && (
                  <button
                    onClick={() => handleStatusChange(room.id, 'OCCUPIED')}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase"
                  >
                    Set Occupied
                  </button>
                )}
                {room.status === 'OCCUPIED' && (
                  <button
                    onClick={() => handleStatusChange(room.id, 'CLEANING')}
                    className="px-3 py-1 bg-sky-600 text-white rounded-xl text-[10px] font-bold uppercase"
                  >
                    Start Clean
                  </button>
                )}
                {room.status === 'CLEANING' && (
                  <button
                    onClick={() => handleStatusChange(room.id, 'AVAILABLE')}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase"
                  >
                    Complete Clean
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Room</th>
                <th className="p-4">Floor</th>
                <th className="p-4">Type</th>
                <th className="p-4">Price</th>
                <th className="p-4">Capacity</th>
                <th className="p-4">Status</th>
                <th className="p-4">Current Guest</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map(room => (
                <tr key={room.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-extrabold text-slate-800">{room.name}</td>
                  <td className="p-4 text-slate-500">{room.floorName}</td>
                  <td className="p-4 text-slate-500">{room.roomTypeName}</td>
                  <td className="p-4 font-bold text-slate-800">${room.basePrice.toFixed(2)}</td>
                  <td className="p-4 text-slate-500">{room.capacity} Pax</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${statusColors[room.status] || ''}`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{room.assignedGuest || 'None'}</td>
                  <td className="p-4 text-right flex items-center justify-end gap-1">
                    <button onClick={() => openEditModal(room)} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteRoom(room.id)} className="p-1.5 hover:bg-slate-100 rounded text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <h3 className="font-black text-slate-900 text-lg border-b pb-2">Add New Hotel Room</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Room Number</label>
                  <input
                    type="text"
                    required
                    value={form.number}
                    onChange={e => setForm({ ...form, number: e.target.value })}
                    className="w-full rounded-xl border p-2 focus:outline-none"
                    placeholder="e.g. 104"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Room Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border p-2 focus:outline-none"
                    placeholder="e.g. Room 104"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Floor Level</label>
                  <select
                    value={form.floorId}
                    onChange={e => setForm({ ...form, floorId: e.target.value })}
                    className="w-full rounded-xl border p-2 bg-white"
                  >
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Room Type Tier</label>
                  <select
                    value={form.roomTypeId}
                    onChange={e => setForm({ ...form, roomTypeId: e.target.value })}
                    className="w-full rounded-xl border p-2 bg-white"
                  >
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Nightly Base Rate</label>
                  <input
                    type="number"
                    required
                    value={form.basePrice}
                    onChange={e => setForm({ ...form, basePrice: Number(e.target.value) })}
                    className="w-full rounded-xl border p-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Capacity Adults/Children</label>
                  <input
                    type="number"
                    required
                    value={form.capacity}
                    onChange={e => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-full rounded-xl border p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Room Amenities</label>
                <input
                  type="text"
                  value={form.amenities}
                  onChange={e => setForm({ ...form, amenities: e.target.value })}
                  className="w-full rounded-xl border p-2 focus:outline-none"
                  placeholder="Free WiFi, AC, TV, Mini Bar"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-bold"
                >
                  Save Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && activeRoom && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <h3 className="font-black text-slate-900 text-lg border-b pb-2">Edit Room Specs</h3>
            <form onSubmit={handleUpdateRoom} className="space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Room Number</label>
                  <input
                    type="text"
                    required
                    value={form.number}
                    onChange={e => setForm({ ...form, number: e.target.value })}
                    className="w-full rounded-xl border p-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Room Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Base Price per Night</label>
                  <input
                    type="number"
                    required
                    value={form.basePrice}
                    onChange={e => setForm({ ...form, basePrice: Number(e.target.value) })}
                    className="w-full rounded-xl border p-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Capacity Pax</label>
                  <input
                    type="number"
                    required
                    value={form.capacity}
                    onChange={e => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-full rounded-xl border p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Amenities (comma-separated)</label>
                <input
                  type="text"
                  value={form.amenities}
                  onChange={e => setForm({ ...form, amenities: e.target.value })}
                  className="w-full rounded-xl border p-2 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-bold"
                >
                  Update Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUGGESTIONS MODAL */}
      {showSuggestionsModal && activeRoom && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center gap-2 border-b pb-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-black text-slate-900 text-md">Smart Room Upgrade/Alternative Suggestions</h3>
            </div>
            
            <p className="text-slate-500">Selected Room {activeRoom.number} is currently <strong>{activeRoom.status}</strong>. Here are available alternatives:</p>

            <div className="space-y-2.5">
              {suggestions.map(s => (
                <div key={s.roomId} className="p-3 bg-slate-50 border rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Room {s.roomNumber}</h4>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Reason: {s.reason}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 block">${s.price.toFixed(2)}</span>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">{s.status}</span>
                  </div>
                </div>
              ))}
              {suggestions.length === 0 && (
                <div className="text-center py-6 text-slate-400 italic">No alternative vacant rooms available matching constraints.</div>
              )}
            </div>

            <button
              onClick={() => setShowSuggestionsModal(false)}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-bold rounded-xl uppercase tracking-wider mt-4"
            >
              Close Suggestions
            </button>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistoryModal && activeRoom && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg p-6 space-y-4 shadow-2xl text-xs">
            <h3 className="font-black text-slate-900 text-lg border-b pb-2">Room {activeRoom.number} Booking History Log</h3>
            
            <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {bookingHistory.map(b => (
                <div key={b.id} className="pt-2 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-800">{b.guestName}</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">{new Date(b.checkIn).toLocaleDateString()} to {new Date(b.checkOut).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 block">${b.rate.toFixed(2)}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">{b.status}</span>
                  </div>
                </div>
              ))}
              {bookingHistory.length === 0 && (
                <div className="text-center py-6 text-slate-400 italic">No booking history logged.</div>
              )}
            </div>

            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
            >
              Close History Logs
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
