import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import {
  Calendar,
  Clock,
  Building,
  CheckCircle,
  Plus,
  Table,
  DollarSign,
  ShieldCheck,
  ListChecks
} from 'lucide-react';

interface ServiceOption {
  id: string;
  type: string;
  label: string;
}

interface ReservationItem {
  id: string;
  serviceType: string;
  guestName: string;
  guestPhone?: string | null;
  roomNumber?: string | null;
  tableNumber?: string | null;
  partySize: number;
  reservationTime: string;
  estimatedCost: number;
  status: string;
  notes?: string | null;
  creator: { id: string; name: string; email: string };
}

const serviceMetadata: Record<string, { hint: string; requires: string[]; defaultSize: number }> = {
  HOTEL_ROOM_SERVICE: {
    hint: 'Schedule in-room delivery or minibar restocking for the guest.',
    requires: ['roomNumber'],
    defaultSize: 1
  },
  RESTAURANT_BOOKING: {
    hint: 'Reserve a dining table for restaurant guests and service staff.',
    requires: ['tableNumber'],
    defaultSize: 2
  },
  BAR_RESERVATION: {
    hint: 'Block a bar counter section for a private drink experience.',
    requires: ['tableNumber'],
    defaultSize: 2
  },
  CAFE_RESERVATION: {
    hint: 'Reserve cafe seating for coffee service and quick bites.',
    requires: ['tableNumber'],
    defaultSize: 2
  },
  BANQUET_BOOKING: {
    hint: 'Create banquet events with dedicated halls, menu packages and guest lists.',
    requires: [],
    defaultSize: 12
  }
};

export default function ReservationsPage() {
  const { token, propertyId } = useAuthStore();
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [reservationTime, setReservationTime] = useState('');
  const [notes, setNotes] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedMetadata = useMemo(() => selectedService ? serviceMetadata[selectedService] : null, [selectedService]);

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/reservations/services', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Unable to load property services');
      }
      const data: ServiceOption[] = await res.json();
      setServices(data);
      if (!selectedService && data.length > 0) {
        setSelectedService(data[0].type);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch services');
    }
  };

  const fetchReservations = async () => {
    try {
      const res = await fetch('/api/reservations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Unable to load reservations');
      }
      const data: ReservationItem[] = await res.json();
      setReservations(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch reservations');
    }
  };

  useEffect(() => {
    fetchServices();
    fetchReservations();
  }, [token]);

  useEffect(() => {
    if (selectedService && serviceMetadata[selectedService]) {
      setPartySize(serviceMetadata[selectedService].defaultSize);
    }
  }, [selectedService]);

  useEffect(() => {
    if (!selectedService || !serviceMetadata[selectedService]) {
      setEstimatedCost(0);
      return;
    }
    const serviceRate = {
      HOTEL_ROOM_SERVICE: 60,
      RESTAURANT_BOOKING: 35,
      BANQUET_BOOKING: 150,
      BAR_RESERVATION: 25,
      CAFE_RESERVATION: 18
    }[selectedService] || 30;
    const cost = selectedService === 'HOTEL_ROOM_SERVICE' ? serviceRate : serviceRate * Math.max(1, partySize);
    setEstimatedCost(cost);
  }, [selectedService, partySize]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);
    if (!selectedService) {
      setErrorMessage('Please select a service module before booking.');
      return;
    }
    if (!guestName.trim()) {
      setErrorMessage('Please enter guest name.');
      return;
    }
    if (!reservationTime) {
      setErrorMessage('Please choose a reservation time.');
      return;
    }

    setIsLoading(true);
    try {
      const body = {
        serviceType: selectedService,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || null,
        roomNumber: roomNumber.trim() || null,
        tableNumber: tableNumber.trim() || null,
        partySize,
        reservationTime,
        notes: notes.trim() || null,
        estimatedCost
      };

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Unable to create reservation');
      }

      await fetchReservations();
      setStatusMessage('Reservation created successfully. Booking has been added to the timeline.');
      setGuestName('');
      setGuestPhone('');
      setNotes('');
      setRoomNumber('');
      setTableNumber('');
      setReservationTime('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Reservation creation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const upcomingReservations = reservations.filter((reservation) => new Date(reservation.reservationTime) >= new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-extrabold text-2xl tracking-tight flex items-center gap-3">
            <Building className="text-primary w-7 h-7" />
            Reservations & Venue Booking
          </h2>
          <p className="text-xs text-text/50 max-w-2xl">
            Book rooms, restaurant tables, banquet halls, bar seating and cafe reservations from a unified property booking console.
          </p>
        </div>
        <div className="rounded-3xl border border-border/20 bg-surface/80 p-4 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-text/50 font-black">Property Scope</div>
          <div className="mt-1 text-sm font-bold text-text">{propertyId || 'Unknown'}</div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700">
          <div className="font-bold uppercase tracking-widest">Reservation error</div>
          <p>{errorMessage}</p>
        </div>
      )}

      {statusMessage && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
          <div className="font-bold uppercase tracking-widest">Booking submitted</div>
          <p>{statusMessage}</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="bg-surface/30 border border-border/20 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <ListChecks className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-black text-lg">New Reservation</h3>
              <p className="text-[11px] text-text/50">Fill the booking details and confirm the guest request.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Service Type</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.type}>{service.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Guest Name</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest full name"
                  className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Phone</label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="Optional phone number"
                  className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Reservation Time</label>
                <input
                  type="datetime-local"
                  value={reservationTime}
                  onChange={(e) => setReservationTime(e.target.value)}
                  className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {selectedMetadata && selectedMetadata.requires.includes('roomNumber') && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Room Number</label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. 503B"
                  className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {selectedMetadata && selectedMetadata.requires.includes('tableNumber') && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Table Number / Section</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. Table 12"
                  className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Party Size</label>
                <input
                  type="number"
                  min={1}
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add guest preferences or event details"
                  className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-border/20 bg-bg/80 p-4 text-sm text-text/70">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Estimated Billing Preview</span>
                <span className="font-black">${estimatedCost.toFixed(2)}</span>
              </div>
              <p className="text-[10px] mt-2 text-text/50">This estimate is generated using the linked service package rate and guest party size.</p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary-hover text-surface font-black text-xs uppercase py-3 rounded-xl transition-all shadow-md"
            >
              {isLoading ? 'Saving booking...' : <><Plus className="w-4 h-4" /> Create Reservation</>}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-surface/30 border border-border/20 rounded-3xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-secondary" />
              <div>
                <h3 className="font-black text-lg">Service Registry</h3>
                <p className="text-[11px] text-text/50">Active property services available for booking.</p>
              </div>
            </div>
            <div className="space-y-2">
              {services.length === 0 ? (
                <div className="text-sm text-text/60">No services are enabled yet. Please configure property services under settings.</div>
              ) : (
                services.map((service) => (
                  <div key={service.id} className="rounded-3xl border border-border/10 bg-bg p-3 text-sm text-text/70">
                    <div className="flex items-center justify-between gap-4">
                      <span>{service.label}</span>
                      <span className="text-[10px] uppercase tracking-widest text-text/50">Enabled</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="bg-surface/30 border border-border/20 rounded-3xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-black text-lg">Next Bookings</h3>
                <p className="text-[11px] text-text/50">Upcoming reservations across all enabled outlets.</p>
              </div>
            </div>
            {upcomingReservations.length === 0 ? (
              <div className="text-sm text-text/60">No upcoming reservations found.</div>
            ) : (
              <div className="space-y-3">
                {upcomingReservations.slice(0, 4).map((reservation) => (
                  <div key={reservation.id} className="rounded-3xl border border-border/10 bg-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-text">{reservation.guestName}</p>
                        <p className="text-[10px] text-text/50">{reservation.serviceType.replace(/_/g, ' ')}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-[10px] uppercase font-black">{reservation.status}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[11px] text-text/60">
                      <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />{new Date(reservation.reservationTime).toLocaleString()}</span>
                      <span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" />${reservation.estimatedCost.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="bg-surface/30 border border-border/20 rounded-3xl p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <div>
            <h3 className="font-black text-lg">Reservation Timeline</h3>
            <p className="text-[11px] text-text/50">Review all booking records for reconciliation and venue planning.</p>
          </div>
        </div>
        {reservations.length === 0 ? (
          <div className="text-sm text-text/60">No reservations have been created for this property yet.</div>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => (
              <motion.article
                key={reservation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-3xl border border-border/10 bg-bg p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-text">{reservation.guestName}</p>
                    <p className="text-[11px] text-text/50">{reservation.serviceType.replace(/_/g, ' ')} · {reservation.creator.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
                    <span className="rounded-full bg-primary/10 text-primary px-2.5 py-1">{reservation.status}</span>
                    <span className="rounded-full bg-secondary/10 text-secondary px-2.5 py-1">{reservation.roomNumber || reservation.tableNumber || 'General'}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 text-[11px] text-text/60">
                  <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" />{new Date(reservation.reservationTime).toLocaleString()}</span>
                  <span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" />${reservation.estimatedCost.toFixed(2)}</span>
                  <span className="flex items-center gap-2"><Table className="w-3.5 h-3.5" />{reservation.tableNumber || reservation.roomNumber || 'N/A'}</span>
                </div>
                {reservation.notes && <p className="mt-3 text-[11px] text-text/70">Notes: {reservation.notes}</p>}
              </motion.article>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
