import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building, Coffee, Utensils, Star, Image, Wine, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const options = [
  { 
    id: 'hotel', 
    label: 'Hotel Management', 
    desc: 'Reservations, Rooms, Check In/Out, Housekeeping & Billing', 
    icon: Building, 
    theme: 'from-blue-500 to-indigo-600',
    accent: 'text-blue-400'
  },
  { 
    id: 'restaurant', 
    label: 'Restaurant POS', 
    desc: 'Dining tables, Kitchen Queue, Order tracking & POS system', 
    icon: Utensils, 
    theme: 'from-emerald-400 to-teal-600',
    accent: 'text-emerald-400'
  },
  { 
    id: 'hotel_restaurant', 
    label: 'Hotel + Restaurant', 
    desc: 'Operate both hospitality segments in a unified console', 
    icon: Flame, 
    theme: 'from-fuchsia-500 to-pink-600',
    accent: 'text-fuchsia-400'
  },
  { 
    id: 'cafe', 
    label: 'Morning Roast Cafe', 
    desc: 'Coffee orders, pastry inventory, cafe seating & billing', 
    icon: Coffee, 
    theme: 'from-amber-400 to-orange-500',
    accent: 'text-amber-400'
  },
  { 
    id: 'bar', 
    label: 'Velvet Bar Lounge', 
    desc: 'Liquor stock levels, custom cocktail list & dark theme ordering', 
    icon: Wine, 
    theme: 'from-rose-600 to-slate-900',
    accent: 'text-rose-400'
  },
  { 
    id: 'banquet', 
    label: 'Banquet & Events', 
    desc: 'Conferences, weddings, party calendar & catering bundles', 
    icon: Star, 
    theme: 'from-violet-500 to-indigo-700',
    accent: 'text-violet-400'
  },
  { 
    id: 'retro', 
    label: 'Retro Theme Hotel', 
    desc: 'Elegant vintage dashboard style with golden luxury tones', 
    icon: Image, 
    theme: 'from-amber-600 to-yellow-800',
    accent: 'text-yellow-500'
  }
];

export default function DemoSelector() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelected(id);
    localStorage.setItem('demo_selected', id);

    const role = user?.role;
    const go = () => {
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (role === 'MANAGER') {
        navigate('/manager');
      } else if (role === 'WAITER') {
        navigate('/waiter');
      } else {
        navigate('/');
      }
    };

    setTimeout(go, 600);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl w-full z-10 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 max-w-2xl"
        >
          <div className="w-14 h-14 bg-gradient-to-tr from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-4">
            <Building className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Choose Your Hospitality Business
          </h1>
          <p className="mt-3 text-slate-400 text-sm">
            Select a tailored demo module configuration. Each choice loads a designated visual theme and feature set.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {options.map((opt, idx) => {
            const Icon = opt.icon;
            const isSel = selected === opt.id;
            
            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                whileHover={{ scale: 1.03, translateY: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(opt.id)}
                className={`group text-left p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-48 ${
                  isSel 
                    ? 'bg-slate-900 border-primary shadow-xl shadow-primary/10 ring-2 ring-primary/40' 
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 shadow-lg backdrop-blur-md'
                }`}
              >
                {/* Gradient Card Background Effect */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${opt.theme} opacity-5 group-hover:opacity-10 rounded-bl-full transition-opacity duration-300`} />
                
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${opt.theme} flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:rotate-6`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {isSel && (
                    <motion.div 
                      layoutId="activeIndicator"
                      className="w-3.5 h-3.5 rounded-full bg-primary"
                    />
                  )}
                </div>

                <div>
                  <h3 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
                    {opt.label}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed font-normal">
                    {opt.desc}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-xs text-slate-500 font-semibold uppercase tracking-widest"
        >
          Hospitality OS Enterprise Edition
        </motion.div>
      </div>
    </div>
  );
}
