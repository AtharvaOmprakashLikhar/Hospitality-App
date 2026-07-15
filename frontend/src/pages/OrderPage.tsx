import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Utensils, 
  ShoppingCart, 
  Trash2, 
  Clock, 
  Plus, 
  Minus, 
  AlertCircle, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { io } from 'socket.io-client';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number | string;
  isAvailable: boolean;
  isVeg: boolean;
  corkageAllowed: boolean;
  corkageFee?: number | string | null;
}

interface MenuVenue {
  id: string;
  name: string;
  type: string;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

interface ActiveOrder {
  id: string;
  tableId: string;
  status: 'SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'CLOSED';
  activeVersion: {
    version: number;
    items: Array<{
      menuItem: MenuItem;
      quantity: number;
      notes: string | null;
    }>;
  };
}

export default function OrderPage() {
  const { token, propertyId } = useAuthStore();
  const [tables] = useState<string[]>(['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6', 'Table 7', 'Table 8', 'Table 9', 'Table 10', 'Table 11', 'Table 12']);
  const [selectedTable, setSelectedTable] = useState<string>('Table 1');

  // Venue & Menu state
  const [venues, setVenues] = useState<MenuVenue[]>([]);
  const [activeVenue, setActiveVenue] = useState<MenuVenue | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Cart & Order state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [tableStatuses, setTableStatuses] = useState<Record<string, ActiveOrder['status'] | 'NONE'>>({});

  const [notesInput, setNotesInput] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch Table Statuses
  const fetchAllTableStatuses = async () => {
    try {
      const statuses: Record<string, ActiveOrder['status'] | 'NONE'> = {};
      for (const t of tables) {
        const res = await fetch(`/api/orders/table/${t}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          statuses[t] = data ? data.status : 'NONE';
        } else {
          statuses[t] = 'NONE';
        }
      }
      setTableStatuses(statuses);
    } catch {}
  };

  useEffect(() => {
    fetchVenues();
    fetchAllTableStatuses();

    // Socket.io for live updates
    const socket = io('/', { transports: ['websocket'] });
    socket.emit('join_property', propertyId);

    socket.on('order:sent', (order: any) => {
      if (order.tableId === selectedTable) {
        fetchActiveOrderForTable(selectedTable);
      }
      setTableStatuses(prev => ({ ...prev, [order.tableId]: order.status }));
    });

    socket.on('order:revised', (order: any) => {
      if (order.tableId === selectedTable) {
        fetchActiveOrderForTable(selectedTable);
      }
      setTableStatuses(prev => ({ ...prev, [order.tableId]: order.status }));
    });

    socket.on('order:status_updated', (order: any) => {
      if (order.tableId === selectedTable) {
        fetchActiveOrderForTable(selectedTable);
      }
      setTableStatuses(prev => ({ ...prev, [order.tableId]: order.status }));
    });

    // Listen to menu availability toggles from managers
    socket.on('menu:updated', () => {
      fetchMenuItems();
    });

    return () => {
      socket.disconnect();
    };
  }, [propertyId, selectedTable]);

  const fetchVenues = async () => {
    try {
      const res = await fetch('/api/menu/venues', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVenues(data);
        if (data.length > 0) {
          setActiveVenue(data[0]);
        }
      }
    } catch {}
  };

  const fetchMenuItems = async () => {
    if (!activeVenue) return;
    try {
      const res = await fetch(`/api/menu/venues/${activeVenue.id}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data);
        const cats = Array.from(new Set<string>(data.map((i: any) => i.category)));
        setCategories(cats);
        if (cats.length > 0) {
          setActiveCategory(cats[0]);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchMenuItems();
  }, [activeVenue]);

  const fetchActiveOrderForTable = async (tableId: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orders/table/${tableId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const orderData = await res.json();
        setActiveOrder(orderData);
        if (orderData && orderData.activeVersion) {
          // Pre-fill cart with active version items
          const items = orderData.activeVersion.items.map((i: any) => ({
            menuItemId: i.menuItem.id,
            name: i.menuItem.name,
            price: Number(i.menuItem.price),
            quantity: i.quantity,
            notes: i.notes || ''
          }));
          setCart(items);
          
          // Pre-fill notes inputs
          const notes: Record<string, string> = {};
          items.forEach((item: any) => {
            notes[item.menuItemId] = item.notes;
          });
          setNotesInput(notes);
        } else {
          setCart([]);
          setNotesInput({});
        }
      }
    } catch {
      setErrorMsg('Failed to load table order details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveOrderForTable(selectedTable);
  }, [selectedTable]);

  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) return;
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id);
      if (existing) {
        return prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        return [...prev, {
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: 1,
          notes: ''
        }];
      }
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => prev.filter(i => i.menuItemId !== menuItemId));
  };

  const updateQuantity = (menuItemId: string, amount: number) => {
    setCart(prev => prev.map(i => {
      if (i.menuItemId === menuItemId) {
        const nextQ = i.quantity + amount;
        return nextQ > 0 ? { ...i, quantity: nextQ } : i;
      }
      return i;
    }));
  };

  const handleNotesChange = (menuItemId: string, value: string) => {
    setNotesInput(prev => ({ ...prev, [menuItemId]: value }));
    setCart(prev => prev.map(i => i.menuItemId === menuItemId ? { ...i, notes: value } : i));
  };

  const handleSendOrder = async () => {
    if (cart.length === 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const body = {
      tableId: selectedTable,
      items: cart.map(i => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        notes: i.notes
      }))
    };

    try {
      const endpoint = activeOrder ? `/api/orders/${activeOrder.id}/revise` : '/api/orders';
      const method = activeOrder ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Submission failed');
      }

      setSuccessMsg(activeOrder ? 'Order revision sent to kitchen!' : 'Order sent to kitchen!');
      fetchActiveOrderForTable(selectedTable);
      fetchAllTableStatuses();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit order');
    } finally {
      setIsLoading(false);
    }
  };

  const totalCartCost = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-extrabold text-2xl tracking-tight flex items-center gap-3">
          <Utensils className="text-primary w-7 h-7 animate-pulse" />
          Waiter Dining Floor Control
        </h2>
        <p className="text-xs text-text/50">Browse the menu, track live table KOT stages, and dispatch orders to the kitchen.</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/20 border border-rose-500/40 text-rose-400 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid of Tables */}
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-3">
        {tables.map(table => {
          const status = tableStatuses[table] || 'NONE';
          let borderClr = 'border-border/30 bg-surface/20';
          let statusLabel = 'Available';
          let dotClr = 'bg-text/30';

          if (status === 'SENT') {
            borderClr = 'border-amber-500/50 bg-amber-500/10';
            statusLabel = 'Sent';
            dotClr = 'bg-amber-500';
          } else if (status === 'PREPARING') {
            borderClr = 'border-rose-500/50 bg-rose-500/10';
            statusLabel = 'Prep';
            dotClr = 'bg-rose-500';
          } else if (status === 'READY') {
            borderClr = 'border-emerald-500/50 bg-emerald-500/10';
            statusLabel = 'Ready';
            dotClr = 'bg-emerald-500';
          }

          return (
            <button
              key={table}
              onClick={() => setSelectedTable(table)}
              className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1.5 shadow-sm hover:scale-[1.03] ${
                selectedTable === table 
                  ? 'ring-2 ring-primary border-primary bg-primary/5' 
                  : borderClr
              }`}
            >
              <span className="text-xs font-black">{table}</span>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${dotClr}`} />
                <span className="text-[8px] font-bold text-text/40 uppercase">{statusLabel}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Menu Browser Panel */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface/20 border border-border/20 rounded-3xl p-5 backdrop-blur-md space-y-4">
            
            {/* Venue select tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border/20">
              {venues.map(v => (
                <button
                  key={v.id}
                  onClick={() => setActiveVenue(v)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all flex-shrink-0 ${
                    activeVenue?.id === v.id
                      ? 'bg-text text-surface border-text'
                      : 'bg-surface/30 text-text/60 border-border/40 hover:bg-surface/50'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>

            {/* Category tabs */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto">
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl transition-all border ${
                      activeCategory === c
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-transparent border-border/20 text-text/50 hover:bg-surface/30'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* Menu Items Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {menuItems
                .filter(item => item.category === activeCategory)
                .map(item => (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 bg-surface/10 ${
                      item.isAvailable 
                        ? 'border-border/30 hover:border-primary/40' 
                        : 'border-border/10 opacity-50 bg-surface/5'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-sm text-text">{item.name}</span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      </div>
                      <p className="text-[10px] text-text/40 mt-1 line-clamp-2">{item.description || 'No description provided.'}</p>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-black text-primary">${Number(item.price).toFixed(2)}</span>
                      {item.isAvailable ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="bg-primary hover:bg-primary-hover text-surface text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add to order
                        </button>
                      ) : (
                        <span className="text-[9px] font-bold text-red-400 bg-red-400/10 border border-red-400/20 px-2.5 py-1 rounded-xl uppercase flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          86'd (Out of stock)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {menuItems.filter(item => item.category === activeCategory).length === 0 && (
              <div className="text-center py-10 text-text/30 text-xs">
                No active menu items available in this category.
              </div>
            )}

          </div>
        </div>

        {/* Live Cart & KOT Review Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface/20 border border-border/20 rounded-3xl p-5 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <h3 className="font-black text-sm">Table Order Ticket</h3>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-primary/10 text-primary uppercase border border-primary/20">
                {selectedTable}
              </span>
            </div>

            {/* Active Order status if present */}
            {activeOrder && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                  <div>
                    <span className="font-black text-amber-500 block">KOT Active (v{activeOrder.activeVersion.version})</span>
                    <span className="text-[9px] text-text/40">Status: {activeOrder.status}</span>
                  </div>
                </div>
                <span className="text-[9px] font-black text-text/50 uppercase">Update Mode</span>
              </div>
            )}

            {/* Items list */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {cart.map(item => (
                <div key={item.menuItemId} className="p-3.5 rounded-xl border border-border/20 bg-surface/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{item.name}</span>
                    <button 
                      onClick={() => removeFromCart(item.menuItemId)}
                      className="text-text/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-primary font-black">${(item.price * item.quantity).toFixed(2)}</span>
                    
                    <div className="flex items-center gap-2.5 bg-bg/50 border border-border/20 rounded-lg p-1">
                      <button 
                        onClick={() => updateQuantity(item.menuItemId, -1)}
                        className="p-1 hover:bg-surface/50 rounded transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                        className="p-1 hover:bg-surface/50 rounded transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <input 
                    type="text"
                    placeholder="Add cooking notes (e.g. less oil, extra spicy)..."
                    value={notesInput[item.menuItemId] || ''}
                    onChange={(e) => handleNotesChange(item.menuItemId, e.target.value)}
                    className="w-full bg-bg/30 border border-border/20 rounded-lg px-2.5 py-1.5 text-[10px] text-text placeholder-text/30 focus:outline-none focus:border-primary/50"
                  />
                </div>
              ))}

              {cart.length === 0 && (
                <div className="text-center py-10 text-text/30 text-xs">
                  Cart is empty. Add dishes from the menu catalog to begin.
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-border/25 pt-4 space-y-4">
                <div className="flex justify-between items-center text-xs font-black">
                  <span>Gross Estimation:</span>
                  <span className="text-primary text-sm">${totalCartCost.toFixed(2)}</span>
                </div>

                <button
                  onClick={handleSendOrder}
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-primary-hover text-surface text-xs font-black uppercase py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : activeOrder ? (
                    'Update Kitchen Order Version'
                  ) : (
                    'Send Ticket to Kitchen'
                  )}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
