import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Coffee, GlassWater, ClipboardList, Package, CheckCircle } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  stockLevel?: number;
  reorderPoint?: number;
}

interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
}

export default function CafeBarPage() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'cafe' | 'bar'>('cafe');

  // Menu lists
  const [cafeMenu, setCafeMenu] = useState<MenuItem[]>([]);
  const [barMenu, setBarMenu] = useState<MenuItem[]>([]);
  const [barInventory, setBarInventory] = useState<MenuItem[]>([]);
  
  // Cart/POS Order checkout state
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedTable, setSelectedTable] = useState('Table 1');
  const [checkoutInvoice, setCheckoutInvoice] = useState<any>(null);

  const fetchMenus = async () => {
    try {
      const res = await fetch('/api/menu/venues', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const venues = await res.json();
        
        // Find Cafe venue
        const cafeVenue = venues.find((v: any) => v.type === 'CAFE');
        if (cafeVenue) {
          const itemsRes = await fetch(`/api/menu/venues/${cafeVenue.id}/items`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (itemsRes.ok) {
            const items = await itemsRes.json();
            setCafeMenu(items.map((it: any) => ({ ...it, price: Number(it.price) })));
          }
        }

        // Find Bar venue
        const barVenue = venues.find((v: any) => v.type === 'BAR');
        if (barVenue) {
          const itemsRes = await fetch(`/api/menu/venues/${barVenue.id}/items`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (itemsRes.ok) {
            const items = await itemsRes.json();
            setBarMenu(items.map((it: any) => ({ ...it, price: Number(it.price) })));
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBarInventory = async () => {
    try {
      const res = await fetch('/api/hospitality/bar/inventory', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBarInventory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMenus();
    fetchBarInventory();
  }, [token]);

  const addToCart = (item: MenuItem) => {
    const existing = cart.find(it => it.menuItem.id === item.id);
    if (existing) {
      setCart(cart.map(it => it.menuItem.id === item.id ? { ...it, quantity: it.quantity + 1 } : it));
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(it => it.menuItem.id !== itemId));
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    
    // Simulate transaction print receipt
    const invoiceNumber = `POS-${Date.now().toString().slice(-6)}`;
    const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;

    setCheckoutInvoice({
      invoiceNumber,
      table: selectedTable,
      items: [...cart],
      subtotal,
      tax,
      total,
      timestamp: new Date().toLocaleTimeString()
    });
    setCart([]);
  };

  const currentMenu = activeTab === 'cafe' ? cafeMenu : barMenu;

  return (
    <div className={`space-y-6 min-h-screen p-2 transition-colors duration-300 ${activeTab === 'bar' ? 'bg-slate-950 text-slate-100' : 'bg-transparent text-slate-800'}`}>
      
      {/* Selector Header */}
      <div className={`rounded-3xl border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xl transition-all ${
        activeTab === 'bar' ? 'border-rose-950 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-950'
      }`}>
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            {activeTab === 'cafe' ? (
              <><Coffee className="w-8 h-8 text-amber-500" /> Morning Roast Cafe Dashboard</>
            ) : (
              <><GlassWater className="w-8 h-8 text-rose-500" /> Velvet Lounge Bar Dashboard</>
            )}
          </h2>
          <p className="text-sm opacity-70">
            {activeTab === 'cafe' 
              ? 'Espressos, freshly baked items, warm pastries, and table POS checks.' 
              : 'Premium liquor stock monitoring, custom cocktails, spirits menu, and dark mode POS settlement.'}
          </p>
        </div>
        
        {/* Tab Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('cafe'); setCart([]); setCheckoutInvoice(null); }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'cafe' 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-slate-100 border border-white/5'
            }`}
          >
            <Coffee className="w-4 h-4" /> Cafe Orders
          </button>
          <button
            onClick={() => { setActiveTab('bar'); setCart([]); setCheckoutInvoice(null); }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'bar' 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' 
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <GlassWater className="w-4 h-4" /> Bar & Cocktails
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1.2fr]">
        
        {/* Left pane: Menu Grid and/or inventory list */}
        <div className="space-y-6">
          <div className={`border rounded-3xl p-6 shadow-sm transition-all ${
            activeTab === 'bar' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <h3 className="font-extrabold text-lg mb-4 border-b pb-2 tracking-tight">POS Menu Selections</h3>
            
            {currentMenu.length === 0 ? (
              <div className="py-12 text-center text-sm opacity-55">No items found for this venue category. Seed data may be required.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {currentMenu.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-28 transition-all hover:translate-y-[-2px] hover:shadow-md ${
                      activeTab === 'bar' 
                        ? 'border-slate-800 bg-slate-950/60 hover:bg-slate-950/90' 
                        : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                    }`}
                  >
                    <div>
                      <span className="text-[9px] font-black uppercase opacity-65 tracking-widest block">{item.category}</span>
                      <h4 className="font-extrabold text-sm mt-1">{item.name}</h4>
                    </div>
                    <div className="flex items-center justify-between mt-3 w-full">
                      <span className="font-black text-sm">${item.price.toFixed(2)}</span>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        activeTab === 'bar' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-600'
                      }`}>+</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bar inventory section */}
          {activeTab === 'bar' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-extrabold text-lg tracking-tight flex items-center gap-1.5">
                  <Package className="w-5 h-5 text-rose-500" /> Liquor Inventory Log
                </h3>
                <button
                  onClick={fetchBarInventory}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold tracking-wider"
                >
                  Reload Inventory
                </button>
              </div>

              <div className="space-y-3">
                {barInventory.map(item => {
                  const isLow = (item.stockLevel || 0) <= (item.reorderPoint || 20);
                  return (
                    <div key={item.id} className="p-3.5 bg-slate-950/50 border border-slate-800/70 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white text-sm">{item.name}</div>
                        <div className="text-slate-400 mt-1">{item.category}</div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className={`font-black text-base ${isLow ? 'text-rose-500' : 'text-emerald-400'}`}>
                            {item.stockLevel} units
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">Min Reorder: {item.reorderPoint}</div>
                        </div>
                        {isLow && (
                          <span className="bg-rose-500/10 border border-rose-500/40 text-rose-400 font-bold px-2 py-1 rounded text-[9px] uppercase tracking-wider">
                            Low Stock
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right pane: Cart and POS checkout bill */}
        <div className="space-y-6">
          
          {/* Order Checkout Pane */}
          <div className={`border rounded-3xl p-6 shadow-sm transition-all flex flex-col justify-between min-h-[400px] ${
            activeTab === 'bar' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="space-y-4">
              <h3 className="font-extrabold text-lg border-b pb-2 tracking-tight flex items-center gap-2">
                <ClipboardList className={`w-5 h-5 ${activeTab === 'bar' ? 'text-rose-500' : 'text-amber-500'}`} /> Active POS Receipt
              </h3>
              
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-60">Dining Table / Section</label>
                <select
                  value={selectedTable}
                  onChange={e => setSelectedTable(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold focus:outline-none cursor-pointer ${
                    activeTab === 'bar' 
                      ? 'bg-slate-950 border-slate-800 text-white' 
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="Table 1">Table 1 (2-seater)</option>
                  <option value="Table 2">Table 2 (4-seater)</option>
                  <option value="Table 3">Table 3 (Bar Counter)</option>
                  <option value="Table 4">Table 4 (Rooftop)</option>
                  <option value="Takeaway">Direct Room Delivery</option>
                </select>
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center text-xs opacity-55">POS check is empty. Click items to order.</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {cart.map(item => (
                    <div key={item.menuItem.id} className="pt-2 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold">{item.menuItem.name}</div>
                        <div className="opacity-60 mt-0.5">${item.menuItem.price.toFixed(2)} x {item.quantity}</div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.menuItem.id)}
                        className="text-rose-500 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-200/50 pt-4 space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between opacity-70">
                    <span>Subtotal:</span>
                    <span>${cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between opacity-70">
                    <span>GST (18%):</span>
                    <span>${(cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0) * 0.18).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm border-t border-slate-100 pt-2">
                    <span>Final Amount:</span>
                    <span>
                      ${(cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0) * 1.18).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider text-white transition-all ${
                    activeTab === 'bar' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-500 hover:bg-amber-400'
                  }`}
                >
                  Generate POS Settlement Receipt
                </button>
              </div>
            )}
          </div>

          {/* Settle Bill Receipt view */}
          {checkoutInvoice && (
            <div className={`border rounded-3xl p-6 shadow-xl space-y-4 ${
              activeTab === 'bar' ? 'bg-slate-900 border-rose-950 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-sm border-b pb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Bill Settle Confirmation
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Bill Reference:</span>
                  <span className="font-bold text-slate-200">{checkoutInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Assigned Location:</span>
                  <span className="font-bold text-slate-200">{checkoutInvoice.table}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Timestamp:</span>
                  <span className="text-slate-200">{checkoutInvoice.timestamp}</span>
                </div>
                
                <hr className="border-slate-800" />
                
                <div className="space-y-1">
                  {checkoutInvoice.items.map((it: any) => (
                    <div key={it.menuItem.id} className="flex justify-between text-slate-300">
                      <span>{it.menuItem.name} (x{it.quantity})</span>
                      <span>${(it.menuItem.price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                
                <hr className="border-slate-800" />
                
                <div className="flex justify-between font-black text-sm text-white">
                  <span>Grand Total Settle:</span>
                  <span>${checkoutInvoice.total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={() => setCheckoutInvoice(null)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'bar' ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                Clear Receipt View
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
