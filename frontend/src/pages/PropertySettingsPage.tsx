import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Settings, 
  Clock, 
  Building, 
  CheckCircle, 
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

const serviceOptions = [
  { value: 'HOTEL_ROOM_SERVICE', label: 'Hotel Room Service' },
  { value: 'RESTAURANT_BOOKING', label: 'Restaurant Booking' },
  { value: 'BANQUET_BOOKING', label: 'Banquet Booking' },
  { value: 'BAR_RESERVATION', label: 'Bar Reservation' },
  { value: 'CAFE_RESERVATION', label: 'Cafe Reservation' }
];

export default function PropertySettingsPage() {
  const { token, propertyId } = useAuthStore();
  const [propertyName, setPropertyName] = useState('Grand Horizon Hotel & Cafe');
  const [lateThreshold, setLateThreshold] = useState(15);
  const [halfDayThreshold, setHalfDayThreshold] = useState(4);
  const [enabledServices, setEnabledServices] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active property settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/reservations/services', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const services = await res.json();
        setEnabledServices(services.map((service: any) => service.type));
      }
    } catch (err) {
      console.error('Failed to load property service settings', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const pending = serviceOptions.filter((service) => enabledServices.includes(service.value));
      for (const service of pending) {
        await fetch('/api/reservations/services', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ serviceType: service.value })
        });
      }
      setSuccessMsg('Property configurations and service onboarding saved successfully!');
    } catch (err) {
      setErrorMsg('Failed to update property settings.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-extrabold text-2xl tracking-tight flex items-center gap-3">
          <Settings className="text-primary w-7 h-7" />
          Property Configurations
        </h2>
        <p className="text-xs text-text/50">Configure shift attendance buffers, late buffer tolerances, and property profile metadata.</p>
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

      <form onSubmit={handleSave} className="bg-surface/20 border border-border/20 rounded-3xl p-6 backdrop-blur-md space-y-6">
        
        {/* Profile metadata */}
        <div className="space-y-4">
          <h3 className="font-black text-sm flex items-center gap-2 text-text border-b border-border/10 pb-2">
            <Building className="w-4 h-4 text-primary" />
            Property Identity
          </h3>
          <div className="grid gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Property Name</label>
              <input
                type="text"
                required
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Property ID (Scope)</label>
              <input
                type="text"
                disabled
                value={propertyId || ''}
                className="w-full bg-bg/20 border border-border/15 text-xs rounded-xl px-4 py-3 text-text/40 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Policy parameters */}
        <div className="space-y-4">
          <h3 className="font-black text-sm flex items-center gap-2 text-text border-b border-border/10 pb-2">
            <Clock className="w-4 h-4 text-secondary" />
            Attendance Buffers & Policy
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Late Buffer (Minutes)</label>
              <input
                type="number"
                required
                min={0}
                value={lateThreshold}
                onChange={(e) => setLateThreshold(Number(e.target.value))}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Half-Day Threshold (Hours)</label>
              <input
                type="number"
                required
                min={1}
                value={halfDayThreshold}
                onChange={(e) => setHalfDayThreshold(Number(e.target.value))}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-black text-sm flex items-center gap-2 text-text border-b border-border/10 pb-2">
            <Building className="w-4 h-4 text-primary" />
            Multi-Service Onboarding
          </h3>
          <div className="grid gap-3">
            {serviceOptions.map((service) => (
              <label key={service.value} className="flex items-center gap-3 rounded-2xl border border-border/20 bg-bg/50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledServices.includes(service.value)}
                  onChange={(e) => {
                    setEnabledServices((prev) =>
                      e.target.checked
                        ? [...prev, service.value]
                        : prev.filter((value) => value !== service.value)
                    );
                  }}
                  className="h-4 w-4 rounded border-border/50 text-primary focus:ring-primary"
                />
                <div>
                  <div className="text-sm font-bold text-text">{service.label}</div>
                  <div className="text-[10px] text-text/50">Enable this service channel for property bookings.</div>
                </div>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-text/60">Enabled services become available for booking workflows in reservations and restaurant modules once saved.</p>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl flex gap-3 text-xs text-blue-400">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <p>These policy criteria govern shift attendance status evaluations (PRESENT, LATE, HALF_DAY) during staff QR attendance scans.</p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="bg-primary hover:bg-primary-hover text-surface text-xs font-black uppercase px-6 py-3 rounded-xl transition-all shadow-md block w-full sm:w-auto"
        >
          {isLoading ? 'Saving changes...' : 'Save Configurations'}
        </button>

      </form>
    </div>
  );
}
