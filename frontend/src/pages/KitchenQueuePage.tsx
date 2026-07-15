import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  ChefHat, 
  CheckCircle, 
  Play, 
  AlertCircle, 
  TrendingUp 
} from 'lucide-react';
import { io } from 'socket.io-client';

interface KitchenTicket {
  id: string;
  tableId: string;
  status: 'SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  version: number;
  items: Array<{
    id: string;
    quantity: number;
    notes: string | null;
    menuItem: {
      name: string;
      category: string;
      isVeg: boolean;
    };
  }>;
}

export default function KitchenQueuePage() {
  const { token, user, propertyId } = useAuthStore();
  const [queue, setQueue] = useState<KitchenTicket[]>([]);
  const [revisedIds, setRevisedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/orders/kitchen-queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch {
      setErrorMsg('Failed to load kitchen order queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    // Socket.io for live updates
    const socket = io('/', { transports: ['websocket'] });
    socket.emit('join_property', propertyId);

    socket.on('order:sent', () => {
      fetchQueue();
    });

    socket.on('order:revised', (order: any) => {
      // Add id to revisedIds to trigger pulse
      setRevisedIds(prev => {
        const updated = new Set(prev);
        updated.add(order.id);
        return updated;
      });
      fetchQueue();

      // Clear pulse after 5 seconds
      setTimeout(() => {
        setRevisedIds(prev => {
          const updated = new Set(prev);
          updated.delete(order.id);
          return updated;
        });
      }, 5000);
    });

    socket.on('order:status_updated', () => {
      fetchQueue();
    });

    return () => {
      socket.disconnect();
    };
  }, [propertyId]);

  const handleUpdateStatus = async (orderId: string, nextStatus: KitchenTicket['status']) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Status update failed');
      }
      fetchQueue();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update order status');
    }
  };

  const getElapsedTime = (createdStr: string) => {
    const elapsedMs = Date.now() - new Date(createdStr).getTime();
    const elapsedMins = Math.floor(elapsedMs / (1000 * 60));
    return `${elapsedMins}m ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-2xl tracking-tight flex items-center gap-3">
            <ChefHat className="text-secondary w-7 h-7" />
            Kitchen Order Tickets (KOT)
          </h2>
          <p className="text-xs text-text/50">Real-time active tickets and preparation tracking. Only current versions are displayed.</p>
        </div>
        <button
          onClick={fetchQueue}
          className="text-xs bg-surface border border-border/40 hover:bg-surface-hover font-bold px-4 py-2 rounded-xl transition-all"
        >
          Refresh Queue
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/20 border border-rose-500/40 text-rose-400 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading && queue.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-surface/10 border border-border/10 rounded-3xl h-[220px]" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {queue.map(ticket => {
            const isRevised = revisedIds.has(ticket.id);
            
            // Ticket Color scoping
            let statusClr = 'border-border/30 bg-surface/20';
            let statusText = 'Sent to Kitchen';
            let actionButton = null;

            if (ticket.status === 'SENT') {
              statusClr = 'border-amber-500/40 bg-amber-500/5';
              statusText = 'New Ticket';
              actionButton = (
                <button
                  onClick={() => handleUpdateStatus(ticket.id, 'PREPARING')}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-surface font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Cooking
                </button>
              );
            } else if (ticket.status === 'PREPARING') {
              statusClr = 'border-rose-500/40 bg-rose-500/5';
              statusText = 'Preparing...';
              actionButton = (
                <button
                  onClick={() => handleUpdateStatus(ticket.id, 'READY')}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Mark Ready
                </button>
              );
            } else if (ticket.status === 'READY') {
              statusClr = 'border-emerald-500/40 bg-emerald-500/5';
              statusText = 'Ready for Pickup';
              
              if (isManagerOrAdmin) {
                actionButton = (
                  <button
                    onClick={() => handleUpdateStatus(ticket.id, 'SERVED')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Mark Served
                  </button>
                );
              } else {
                actionButton = (
                  <div className="text-center text-[10px] text-emerald-400 font-bold bg-emerald-400/10 border border-emerald-400/20 py-2.5 rounded-xl uppercase">
                    Awaiting Server Pickup
                  </div>
                );
              }
            }

            return (
              <div
                key={ticket.id}
                className={`rounded-3xl border p-5 backdrop-blur-md flex flex-col justify-between gap-4 transition-all relative ${
                  isRevised 
                    ? 'ring-4 ring-primary animate-pulse border-primary bg-primary/10 shadow-2xl' 
                    : statusClr
                }`}
              >
                {/* Revised Pulse Alert */}
                {isRevised && (
                  <div className="absolute -top-3 left-4 bg-primary text-surface text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow flex items-center gap-1 animate-bounce">
                    <TrendingUp className="w-2.5 h-2.5" />
                    REVISED
                  </div>
                )}

                <div className="space-y-4">
                  {/* Header info */}
                  <div className="flex items-center justify-between border-b border-border/20 pb-3">
                    <div>
                      <span className="text-sm font-black block">{ticket.tableId}</span>
                      <span className="text-[10px] text-text/40 block font-semibold">{getElapsedTime(ticket.createdAt)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-extrabold text-text/40 block uppercase">V{ticket.version}</span>
                      <span className="text-[9px] font-extrabold text-primary block uppercase">{statusText}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    {ticket.items.map(item => (
                      <div key={item.id} className="text-xs flex flex-col border-b border-border/10 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-text/90">
                            {item.quantity}x {item.menuItem.name}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.menuItem.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        </div>
                        {item.notes && (
                          <span className="text-[10px] text-amber-400 italic mt-0.5 font-medium">
                            * Note: {item.notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  {actionButton}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {queue.length === 0 && !isLoading && (
        <div className="text-center py-20 bg-surface/5 border border-border/10 rounded-3xl p-6">
          <ChefHat className="w-12 h-12 text-text/20 mx-auto mb-3" />
          <h3 className="font-extrabold text-sm">No Active Tickets</h3>
          <p className="text-xs text-text/40 mt-1">All kitchen orders have been served. New tickets will load automatically.</p>
        </div>
      )}
    </div>
  );
}
