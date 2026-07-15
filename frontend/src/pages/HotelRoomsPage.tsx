import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { CheckCircle, Layers } from 'lucide-react';

interface RoomTypeItem {
  id: string;
  name: string;
  capacityAdults: number;
  capacityChildren: number;
  nightlyRate: number;
}

interface RoomItem {
  id: string;
  number: string;
  status: string;
  floor: { name: string };
  roomType: RoomTypeItem;
}

const statusStyles: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  OCCUPIED: 'bg-rose-100 text-rose-700',
  RESERVED: 'bg-amber-100 text-amber-800',
  CLEANING: 'bg-sky-100 text-sky-700',
  MAINTENANCE: 'bg-slate-100 text-slate-700',
  BLOCKED: 'bg-zinc-100 text-zinc-700'
};

export default function HotelRoomsPage() {
  const { token } = useAuthStore();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsRes, typesRes] = await Promise.all([
        fetch('/api/hotel/rooms', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/hotel/room-types', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (!roomsRes.ok || !typesRes.ok) {
        const body = await roomsRes.json().catch(() => null);
        throw new Error(body?.error || 'Unable to fetch room inventory');
      }

      const roomsData = await roomsRes.json();
      const typesData = await typesRes.json();
      setRooms(roomsData);
      setRoomTypes(typesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/60 bg-slate-950/95 p-6 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Rooms & Floor Inventory</h2>
            <p className="text-sm text-slate-300">Track room status, floor assignments, and room type availability at a glance.</p>
          </div>
          <button onClick={fetchRooms} className="rounded-3xl bg-emerald-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-400">
            Refresh Status
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-52 rounded-3xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-900 mb-4">
              <Layers className="w-5 h-5" />
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Room Types</p>
                <p className="text-2xl font-extrabold">{roomTypes.length}</p>
              </div>
            </div>
            <div className="space-y-3">
              {roomTypes.map((roomType) => (
                <div key={roomType.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{roomType.name}</h3>
                      <p className="text-xs text-slate-500">{roomType.capacityAdults} adults · {roomType.capacityChildren} children</p>
                    </div>
                    <p className="text-sm font-black text-slate-900">${roomType.nightlyRate.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Room Grid</p>
                <h3 className="text-2xl font-extrabold text-slate-900">Live Room Status</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-3xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> Available
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => (
                <div key={room.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">Room {room.number}</h4>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{room.floor?.name}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase ${statusStyles[room.status] || 'bg-slate-100 text-slate-700'}`}>
                      {room.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Type</span>
                      <span>{room.roomType?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Capacity</span>
                      <span>{room.roomType?.capacityAdults}A / {room.roomType?.capacityChildren}C</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Nightly Rate</span>
                      <span>${room.roomType?.nightlyRate.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
