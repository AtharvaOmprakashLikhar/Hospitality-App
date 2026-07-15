import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Calendar, UserCheck, Receipt, Coffee, Bell, ShoppingCart, Info, Send } from 'lucide-react';
import InvoiceDetail from '../components/InvoiceDetail';

interface StayItem {
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
  room: { number: string };
  roomType: { name: string };
}

interface RoomServiceItem {
  id: string;
  category: string;
  title: string;
  status: string;
  requestedAt: string;
}

interface CafeOrder {
  id: string;
  tableId: string;
  status: string;
  createdAt: string;
}

interface AlertItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export default function UserPanelPage() {
  const { user, token } = useAuthStore();
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'bookings' | 'invoices' | 'services' | 'orders' | 'alerts'>('profile');

  // State collections
  const [stays, setStays] = useState<StayItem[]>([]);
  const [services, setServices] = useState<RoomServiceItem[]>([]);
  const [restaurantOrders, setRestaurantOrders] = useState<CafeOrder[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  
  // New request state
  const [roomNo, setRoomNo] = useState('');
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceCategory, setServiceCategory] = useState('BREAKFAST');
  const [formSuccess, setFormSuccess] = useState(false);

  // Invoice display state
  const [selectedStay, setSelectedStay] = useState<StayItem | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const fetchUserData = async () => {
    try {
      // 1. Fetch stays
      const staysRes = await fetch('/api/hotel/bookings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (staysRes.ok) {
        const staysData = await staysRes.json();
        setStays(staysData);
      }

      // 2. Fetch room service requests
      const servicesRes = await fetch('/api/hospitality/room-services', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData);
      }

      // 3. Fetch orders
      const ordersRes = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRestaurantOrders(ordersData);
      }

      // 4. Fetch notifications
      const alertsRes = await fetch('/api/hotel/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [token]);

  const handlePlaceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(false);
    if (!roomNo || !serviceTitle) return;

    try {
      const res = await fetch('/api/hospitality/room-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          roomNumber: roomNo,
          category: serviceCategory,
          title: serviceTitle
        })
      });
      if (res.ok) {
        setFormSuccess(true);
        setServiceTitle('');
        setRoomNo('');
        fetchUserData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewInvoice = (stay: StayItem) => {
    setSelectedStay(stay);
    setShowInvoice(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-900">Guest Experience Hub</h2>
            <p className="mt-2 text-sm text-slate-500">Welcome, {user?.name}. Manage your check-ins, order meals, or view print invoice billing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['profile', 'bookings', 'invoices', 'services', 'orders', 'alerts'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  activeSubTab === tab 
                    ? 'bg-primary text-white shadow-md shadow-primary/10' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUB PANELS */}
      {activeSubTab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-2">
            <UserCheck className="w-5 h-5 text-slate-900" />
            <h3 className="font-extrabold text-lg">My Profile Details</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border p-4 bg-slate-50">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</span>
              <span className="font-bold text-slate-800 text-sm mt-1 block">{user?.name}</span>
            </div>
            <div className="rounded-2xl border p-4 bg-slate-50">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</span>
              <span className="font-bold text-slate-800 text-sm mt-1 block">{user?.email}</span>
            </div>
            <div className="rounded-2xl border p-4 bg-slate-50">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role Privilege</span>
              <span className="font-bold text-slate-800 text-sm mt-1 block">{user?.role}</span>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'bookings' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-2">
            <Calendar className="w-5 h-5 text-slate-900" />
            <h3 className="font-extrabold text-lg">My Room Bookings</h3>
          </div>
          
          {stays.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No active stay records.</div>
          ) : (
            <div className="space-y-4">
              {stays.map(stay => (
                <div key={stay.id} className="p-4 border rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-800">Room {stay.room?.number} ({stay.roomType?.name})</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Stay dates: {new Date(stay.checkIn).toLocaleDateString()} to {new Date(stay.checkOut).toLocaleDateString()} ({stay.nights} nights)
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {stay.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-2">
            <Receipt className="w-5 h-5 text-slate-900" />
            <h3 className="font-extrabold text-lg">Settled Invoices</h3>
          </div>

          {stays.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No settled invoices.</div>
          ) : (
            <div className="space-y-3">
              {stays.map(stay => (
                <div key={stay.id} className="p-4 border rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{stay.bookingNumber}</h4>
                    <p className="text-xs text-slate-500 mt-1">Room {stay.room?.number} · Total bill amount: ${stay.remainingAmount === 0 ? (stay.rate * stay.nights * 1.18).toFixed(2) : stay.advancePaid}</p>
                  </div>
                  <button
                    onClick={() => handleViewInvoice(stay)}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                  >
                    View Invoice
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'services' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-2 justify-between">
            <div className="flex items-center gap-2">
              <Coffee className="w-5 h-5 text-slate-900" />
              <h3 className="font-extrabold text-lg">Room Service Requests</h3>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* List */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">My Requests Log</h4>
              {services.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">No active service calls.</div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {services.map(r => (
                    <div key={r.id} className="p-3 border rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{r.title}</div>
                        <div className="text-slate-400 mt-0.5">{r.category} · {new Date(r.requestedAt).toLocaleDateString()}</div>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black uppercase text-slate-600">
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create */}
            <form onSubmit={handlePlaceRequest} className="p-4 border border-dashed rounded-2xl space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Call Frontdesk Service</h4>
              
              {formSuccess && <div className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">Request sent to frontdesk!</div>}
              
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">My Room Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 101"
                  value={roomNo}
                  onChange={e => setRoomNo(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Request Type</label>
                <select
                  value={serviceCategory}
                  onChange={e => setServiceCategory(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none"
                >
                  <option value="BREAKFAST">🍳 Breakfast tray</option>
                  <option value="LAUNDRY">🧺 Laundry pickup</option>
                  <option value="CLEANING">🧹 Extra cleaning</option>
                  <option value="EXTRA_BED">🛏️ Fresh towels / Pillow</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Description</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., two towels please"
                  value={serviceTitle}
                  onChange={e => setServiceTitle(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Call Frontdesk
              </button>
            </form>
          </div>
        </div>
      )}

      {activeSubTab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-2">
            <ShoppingCart className="w-5 h-5 text-slate-900" />
            <h3 className="font-extrabold text-lg">My Restaurant Orders</h3>
          </div>

          {restaurantOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No restaurant POS checks logged.</div>
          ) : (
            <div className="space-y-3">
              {restaurantOrders.map(order => (
                <div key={order.id} className="p-4 border rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-slate-800">Table: {order.tableId}</h4>
                    <p className="text-slate-500 mt-1">Logged on: {new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase">
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'alerts' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-2">
            <Bell className="w-5 h-5 text-slate-900" />
            <h3 className="font-extrabold text-lg">Notification Center</h3>
          </div>

          {alerts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No alerts.</div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <div key={alert.id} className="p-4 border border-indigo-50/50 bg-indigo-50/10 rounded-2xl flex gap-3 text-xs">
                  <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black text-slate-800">{alert.title}</h4>
                    <p className="text-slate-600 mt-1 leading-normal">{alert.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5">{new Date(alert.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settlement detail modal popup */}
      {showInvoice && selectedStay && (
        <InvoiceDetail
          isOpen={showInvoice}
          onClose={() => setShowInvoice(false)}
          booking={selectedStay}
          breakdown={{
            baseCharges: selectedStay.rate * selectedStay.nights,
            lateCheckOutFee: 0,
            miniBarCharges: 0,
            laundryCharges: 0,
            restaurantCharges: 0,
            cafeCharges: 0,
            barCharges: 0,
            roomServiceCharges: 0,
            discount: selectedStay.discount,
            gst: selectedStay.gst,
            advancePaid: selectedStay.advancePaid,
            grandTotal: selectedStay.remainingAmount === 0 ? (selectedStay.rate * selectedStay.nights - selectedStay.discount + selectedStay.gst) : selectedStay.advancePaid
          }}
        />
      )}

    </div>
  );
}
