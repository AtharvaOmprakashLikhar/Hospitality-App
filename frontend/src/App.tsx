import { useEffect, useState, FormEvent } from 'react';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  Outlet, 
  Link, 
  useNavigate, 
  useLocation 
} from 'react-router-dom';
import ThemeEditor from './components/ThemeEditor';
import RosterPage from './pages/RosterPage';
import AttendancePage from './pages/AttendancePage';
import SalaryPage from './pages/SalaryPage';
import MenuPage from './pages/MenuPage';
import OrderPage from './pages/OrderPage';
import KitchenQueuePage from './pages/KitchenQueuePage';
import ReservationsPage from './pages/ReservationsPage';
import AdminApprovalsPage from './pages/AdminApprovalsPage';
import DashboardOverview from './pages/DashboardOverview';
import PropertySettingsPage from './pages/PropertySettingsPage';
import HotelDashboardPage from './pages/HotelDashboardPage';
import HotelBookingsPage from './pages/HotelBookingsPage';
import RoomManagementPage from './pages/RoomManagementPage';
import UserPanelPage from './pages/UserPanelPage';
import DemoSelector from './components/DemoSelector';
import CheckInOutPage from './pages/CheckInOutPage';
import RoomServicePage from './pages/RoomServicePage';
import CafeBarPage from './pages/CafeBarPage';
import BanquetPage from './pages/BanquetPage';
import { 
  RefreshCw, 
  Calendar, 
  Clock, 
  DollarSign, 
  Utensils, 
  LogOut, 
  Key,
  ChefHat,
  UserPlus,
  Lock,
  Phone,
  Mail,
  User as UserIcon,
  CheckCircle,
  TrendingUp,
  ShoppingCart,
  Building,
  Home,
  FileText,
  LogIn,
  Wine,
  Sparkles,
  Settings,
  Star,
  Bell,
  Coffee
} from 'lucide-react';

function getPanelPath(role?: string) {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return '/admin';
  if (role === 'MANAGER') return '/manager';
  if (role === 'WAITER') return '/waiter';
  if (role === 'KITCHEN') return '/kitchen';
  if (role === 'USER') return '/user';
  return '/login';
}

function RootRedirector() {
  const user = useAuthStore(state => state.user);
  return <Navigate to={getPanelPath(user?.role)} replace />;
}

function PublicOnlyRoute({ children }: { children: JSX.Element }) {
  const { token, user } = useAuthStore();
  if (token && user) {
    return <RootRedirector />;
  }
  return children;
}

function AuthGuard() {
  const { token, user } = useAuthStore();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function RoleGuard({ allowedRoles }: { allowedRoles: string[] }) {
  const user = useAuthStore(state => state.user);
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={getPanelPath(user?.role)} replace />;
  }
  return <Outlet />;
}

function getDynamicNavItems(basePath: string) {
  const demoSelected = localStorage.getItem('demo_selected') || 'all';
  const overview = { path: `${basePath}`, label: 'Dashboard Overview', icon: TrendingUp };

  if (demoSelected === 'hotel') {
    return [
      overview,
      { path: `${basePath}/hotel`, label: 'Hotel Dashboard', icon: Building },
      { path: `${basePath}/hotel/bookings`, label: 'Room Booking', icon: Calendar },
      { path: `${basePath}/hotel/rooms`, label: 'Rooms Inventory', icon: Home },
      { path: `${basePath}/hotel/check-in-out`, label: 'Check In/Out Desk', icon: LogIn },
      { path: `${basePath}/hotel/room-service`, label: 'Room Services', icon: Coffee },
      { path: `${basePath}/hotel/reservations`, label: 'Reservations Calendar', icon: Calendar }
    ];
  }
  if (demoSelected === 'restaurant') {
    return [
      overview,
      { path: `${basePath}/restaurant/orders`, label: 'Restaurant POS', icon: ShoppingCart },
      { path: `${basePath}/restaurant/kitchen`, label: 'Kitchen Queue', icon: ChefHat },
      { path: `${basePath}/hotel/reservations`, label: 'Table Bookings', icon: Calendar }
    ];
  }
  if (demoSelected === 'hotel_restaurant') {
    return [
      overview,
      { path: `${basePath}/hotel`, label: 'Hotel Dashboard', icon: Building },
      { path: `${basePath}/hotel/bookings`, label: 'Room Booking', icon: Calendar },
      { path: `${basePath}/hotel/rooms`, label: 'Rooms Inventory', icon: Home },
      { path: `${basePath}/hotel/check-in-out`, label: 'Check In/Out Desk', icon: LogIn },
      { path: `${basePath}/hotel/room-service`, label: 'Room Services', icon: Coffee },
      { path: `${basePath}/restaurant/orders`, label: 'Restaurant POS', icon: ShoppingCart },
      { path: `${basePath}/restaurant/kitchen`, label: 'Kitchen Queue', icon: ChefHat },
      { path: `${basePath}/hotel/reservations`, label: 'Reservations Calendar', icon: Calendar }
    ];
  }
  if (demoSelected === 'cafe') {
    return [
      overview,
      { path: `${basePath}/cafe`, label: 'Morning Roast Cafe', icon: Coffee }
    ];
  }
  if (demoSelected === 'bar') {
    return [
      overview,
      { path: `${basePath}/bar`, label: 'Velvet Lounge Bar', icon: Wine }
    ];
  }
  if (demoSelected === 'banquet') {
    return [
      overview,
      { path: `${basePath}/banquet`, label: 'Banquet & Events', icon: Star }
    ];
  }
  if (demoSelected === 'retro') {
    return [
      overview,
      { path: `${basePath}/retro`, label: 'Retro Luxury Desk', icon: Sparkles },
      { path: `${basePath}/hotel/check-in-out`, label: 'Check In/Out Desk', icon: LogIn },
      { path: `${basePath}/hotel/room-service`, label: 'Room Services', icon: Coffee },
      { path: `${basePath}/hotel/bookings`, label: 'Room Booking', icon: Calendar }
    ];
  }

  // Fallback
  return [
    overview,
    { path: `${basePath}/hotel`, label: 'Hotel Dashboard', icon: Building },
    { path: `${basePath}/hotel/bookings`, label: 'Room Booking', icon: Calendar },
    { path: `${basePath}/hotel/rooms`, label: 'Rooms Inventory', icon: Home },
    { path: `${basePath}/hotel/check-in-out`, label: 'Check In/Out Desk', icon: LogIn },
    { path: `${basePath}/hotel/room-service`, label: 'Room Services', icon: Coffee },
    { path: `${basePath}/restaurant/orders`, label: 'Restaurant POS', icon: ShoppingCart },
    { path: `${basePath}/restaurant/kitchen`, label: 'Kitchen Queue', icon: ChefHat },
    { path: `${basePath}/cafe`, label: 'Cafe Outlet', icon: Coffee },
    { path: `${basePath}/bar`, label: 'Bar Lounge', icon: Wine },
    { path: `${basePath}/banquet`, label: 'Banquet Hall', icon: Star },
    { path: `${basePath}/hotel/reservations`, label: 'Venue Reservations', icon: Calendar }
  ];
}

function AdminLayout() {
  const { user, logout, loginAs } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleRoleSwitch = async (role: string) => {
    await loginAs(role);
    const sessionUser = useAuthStore.getState().user;
    if (sessionUser) {
      navigate(getPanelPath(sessionUser.role));
    }
  };

  const activeRoute = location.pathname;
  const demoSelected = localStorage.getItem('demo_selected') || 'all';
  const isRetro = demoSelected === 'retro';
  
  const navItems = getDynamicNavItems('/admin');
  
  const adminSettingsItems = [
    { path: '/admin/staff', label: 'Staff Scheduling Roster', icon: Calendar },
    { path: '/admin/attendance', label: 'Scan Attendance', icon: Clock },
    { path: '/admin/menu', label: 'Multi-Venue Menu Manage', icon: Utensils },
    { path: '/admin/salary', label: 'Salaries & Payroll Portal', icon: DollarSign },
    { path: '/admin/approvals', label: 'User Role Approvals', icon: UserPlus },
    { path: '/admin/settings', label: 'Property Settings', icon: Settings },
    { path: '/admin/branding', label: 'Branding Editor', icon: Sparkles }
  ];

  const allNavItems = [...navItems];
  adminSettingsItems.forEach(item => {
    if (!allNavItems.find(x => x.path === item.path)) {
      allNavItems.push(item);
    }
  });

  return (
    <div className={`min-h-screen transition-colors duration-200 flex flex-col relative ${
      isRetro 
        ? 'bg-stone-950 text-amber-100 font-serif' 
        : 'bg-bg text-text'
    }`}>
      {isRetro && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.15),rgba(255,255,255,0))] pointer-events-none z-0" />
      )}
      
      <header className={`border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40 relative ${
        isRetro 
          ? 'border-amber-500/20 bg-stone-900 text-amber-100' 
          : 'border-border bg-surface text-text'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-lg shadow-sm ${
            isRetro ? 'bg-amber-500 text-stone-950' : 'bg-primary text-surface'
          }`}>
            A
          </div>
          <div>
            <span className="font-extrabold text-md tracking-tight block">HospitalityOS Admin</span>
            <span className="text-[10px] opacity-60 block font-semibold uppercase tracking-wider">Grand Horizon Hotel</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-3 border rounded-xl px-3 py-1.5 ${
            isRetro ? 'bg-stone-950 border-amber-500/20 text-amber-100' : 'bg-bg border-border'
          }`}>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold">{user?.name}</span>
              <span className={`text-[9px] font-black tracking-wider uppercase ${isRetro ? 'text-amber-400' : 'text-primary'}`}>ADMIN PANEL</span>
            </div>
            
            {/* Quick Demo Switcher */}
            <select
              value={demoSelected}
              onChange={(e) => {
                localStorage.setItem('demo_selected', e.target.value);
                window.location.reload();
              }}
              className={`text-[10px] font-bold rounded px-2 py-1 focus:outline-none cursor-pointer border ${
                isRetro 
                  ? 'bg-stone-900 border-amber-500/20 text-amber-200' 
                  : 'bg-surface border-border text-text'
              }`}
            >
              <option value="all">Full Module View</option>
              <option value="hotel">Hotel Module</option>
              <option value="restaurant">Restaurant POS</option>
              <option value="hotel_restaurant">Hotel + Restaurant</option>
              <option value="cafe">Morning Roast Cafe</option>
              <option value="bar">Velvet Lounge Bar</option>
              <option value="banquet">Banquet Hall</option>
              <option value="retro">Retro Vintage Hotel</option>
            </select>

            <select
              value={user?.role}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              className={`bg-transparent text-[10px] font-bold rounded px-1 py-0.5 focus:outline-none cursor-pointer border-none text-inherit`}
            >
              <option className="bg-slate-900 text-white" value="ADMIN">ADMIN</option>
              <option className="bg-slate-900 text-white" value="MANAGER">MANAGER</option>
              <option className="bg-slate-900 text-white" value="WAITER">WAITER</option>
              <option className="bg-slate-900 text-white" value="KITCHEN">KITCHEN</option>
              <option className="bg-slate-900 text-white" value="USER">USER</option>
            </select>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-xl transition-all" title="Log Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row relative z-10">
        <aside className={`w-full md:w-64 border-r p-4 space-y-2 flex-shrink-0 ${
          isRetro ? 'border-amber-500/10 bg-stone-900/60' : 'border-border bg-surface/50'
        }`}>
          <div className="text-[10px] font-extrabold tracking-wider uppercase opacity-45 px-3 pb-2">Admin Modules</div>
          <div className="space-y-1.5">
            {allNavItems.map(item => {
              const Icon = item.icon;
              const isSelected = activeRoute === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`w-full flex items-center gap-3 font-bold text-xs px-4 py-3 rounded-xl border transition-all ${
                    isSelected 
                      ? (isRetro ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-sm' : 'bg-primary/10 border-primary text-primary shadow-sm')
                      : (isRetro ? 'bg-transparent border-transparent text-amber-200/70 hover:bg-stone-800' : 'bg-transparent border-transparent text-text/75 hover:bg-surface/65')
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </aside>
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-transparent">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ManagerLayout() {
  const { user, logout, loginAs } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleRoleSwitch = async (role: string) => {
    await loginAs(role);
    const sessionUser = useAuthStore.getState().user;
    if (sessionUser) {
      navigate(getPanelPath(sessionUser.role));
    }
  };

  const activeRoute = location.pathname;
  const demoSelected = localStorage.getItem('demo_selected') || 'all';
  const isRetro = demoSelected === 'retro';
  
  const navItems = getDynamicNavItems('/manager');
  
  const managerSettingsItems = [
    { path: '/manager/staff', label: 'Staff Scheduling Roster', icon: Calendar },
    { path: '/manager/attendance', label: 'Scan Attendance', icon: Clock },
    { path: '/manager/menu', label: 'Multi-Venue Menu Manage', icon: Utensils },
    { path: '/manager/leaves', label: 'Review Leave Requests', icon: FileText }
  ];

  const allNavItems = [...navItems];
  managerSettingsItems.forEach(item => {
    if (!allNavItems.find(x => x.path === item.path)) {
      allNavItems.push(item);
    }
  });

  return (
    <div className={`min-h-screen transition-colors duration-200 flex flex-col relative ${
      isRetro 
        ? 'bg-stone-950 text-amber-100 font-serif' 
        : 'bg-bg text-text'
    }`}>
      {isRetro && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.15),rgba(255,255,255,0))] pointer-events-none z-0" />
      )}
      
      <header className={`border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40 relative ${
        isRetro 
          ? 'border-amber-500/20 bg-stone-900 text-amber-100' 
          : 'border-border bg-surface text-text'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-lg shadow-sm ${
            isRetro ? 'bg-amber-500 text-stone-950' : 'bg-secondary text-surface'
          }`}>
            M
          </div>
          <div>
            <span className="font-extrabold text-md tracking-tight block">HospitalityOS Manager</span>
            <span className="text-[10px] opacity-60 block font-semibold uppercase tracking-wider">Grand Horizon Hotel</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-3 border rounded-xl px-3 py-1.5 ${
            isRetro ? 'bg-stone-950 border-amber-500/20 text-amber-100' : 'bg-bg border-border'
          }`}>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold">{user?.name}</span>
              <span className={`text-[9px] font-black tracking-wider uppercase ${isRetro ? 'text-amber-400' : 'text-secondary'}`}>MANAGER PANEL</span>
            </div>

            {/* Quick Demo Switcher */}
            <select
              value={demoSelected}
              onChange={(e) => {
                localStorage.setItem('demo_selected', e.target.value);
                window.location.reload();
              }}
              className={`text-[10px] font-bold rounded px-2 py-1 focus:outline-none cursor-pointer border ${
                isRetro 
                  ? 'bg-stone-900 border-amber-500/20 text-amber-200' 
                  : 'bg-surface border-border text-text'
              }`}
            >
              <option value="all">Full Module View</option>
              <option value="hotel">Hotel Module</option>
              <option value="restaurant">Restaurant POS</option>
              <option value="hotel_restaurant">Hotel + Restaurant</option>
              <option value="cafe">Morning Roast Cafe</option>
              <option value="bar">Velvet Lounge Bar</option>
              <option value="banquet">Banquet Hall</option>
              <option value="retro">Retro Vintage Hotel</option>
            </select>

            <select
              value={user?.role}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              className="bg-transparent text-[10px] font-bold rounded px-1 py-0.5 focus:outline-none cursor-pointer border-none text-inherit"
            >
              <option className="bg-slate-900 text-white" value="ADMIN">ADMIN</option>
              <option className="bg-slate-900 text-white" value="MANAGER">MANAGER</option>
              <option className="bg-slate-950 text-white" value="WAITER">WAITER</option>
              <option className="bg-slate-950 text-white" value="KITCHEN">KITCHEN</option>
              <option className="bg-slate-950 text-white" value="USER">USER</option>
            </select>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-xl transition-all" title="Log Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row relative z-10">
        <aside className={`w-full md:w-64 border-r p-4 space-y-2 flex-shrink-0 ${
          isRetro ? 'border-amber-500/10 bg-stone-900/60' : 'border-border bg-surface/50'
        }`}>
          <div className="text-[10px] font-extrabold tracking-wider uppercase opacity-45 px-3 pb-2">Manager Modules</div>
          <div className="space-y-1.5">
            {allNavItems.map(item => {
              const Icon = item.icon;
              const isSelected = activeRoute === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`w-full flex items-center gap-3 font-bold text-xs px-4 py-3 rounded-xl border transition-all ${
                    isSelected 
                      ? (isRetro ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-sm' : 'bg-secondary/10 border-secondary text-secondary shadow-sm')
                      : (isRetro ? 'bg-transparent border-transparent text-amber-200/70 hover:bg-stone-800' : 'bg-transparent border-transparent text-text/75 hover:bg-surface/65')
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </aside>
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-transparent">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function WaiterLayout() {
  const { user, logout, loginAs } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleRoleSwitch = async (role: string) => {
    await loginAs(role);
    const sessionUser = useAuthStore.getState().user;
    if (sessionUser) {
      navigate(getPanelPath(sessionUser.role));
    }
  };

  const activeRoute = location.pathname;
  const navItems = [
    { path: '/waiter', label: 'Dining Table Orders', icon: ShoppingCart },
    { path: '/waiter/qr', label: 'My Attendance QR', icon: Clock },
    { path: '/waiter/leaves', label: 'My Leave Applications', icon: FileText },
    { path: '/waiter/reservations', label: 'Room/Table Status', icon: Building }
  ];

  return (
    <div className="min-h-screen bg-bg text-text transition-colors duration-200 flex flex-col">
      <header className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-extrabold text-lg shadow-sm">W</div>
          <div>
            <span className="font-extrabold text-md tracking-tight block">HospitalityOS Floor</span>
            <span className="text-[10px] text-text/50 block font-semibold uppercase tracking-wider">Waiter Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-bg border border-border rounded-xl px-3 py-1.5">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-text">{user?.name}</span>
              <span className="text-[9px] font-black tracking-wider uppercase text-primary">WAITER PANEL</span>
            </div>
            <select
              value={user?.role}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              className="bg-surface/50 border border-border/40 text-[10px] font-bold text-text/60 rounded px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="WAITER">WAITER</option>
              <option value="KITCHEN">KITCHEN</option>
              <option value="USER">USER</option>
            </select>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all" title="Log Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-64 border-r border-border bg-surface/50 p-4 space-y-2 flex-shrink-0">
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-text/30 px-3 pb-2">Floor Navigation</div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isSelected = activeRoute === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 font-bold text-xs px-4 py-3.5 rounded-xl border transition-all ${
                  isSelected 
                    ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                    : 'bg-transparent border-transparent text-text/75 hover:bg-surface/65'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </aside>
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-bg/25">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function KitchenLayout() {
  const { user, logout, loginAs } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleRoleSwitch = async (role: string) => {
    await loginAs(role);
    const sessionUser = useAuthStore.getState().user;
    if (sessionUser) {
      navigate(getPanelPath(sessionUser.role));
    }
  };

  const activeRoute = location.pathname;
  const navItems = [
    { path: '/kitchen', label: 'Order Queue', icon: ChefHat },
    { path: '/kitchen/qr', label: 'Clocking QR', icon: Clock },
    { path: '/kitchen/leaves', label: 'Leaves Tab', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-bg text-text transition-colors duration-200 flex flex-col">
      <header className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/20 border border-secondary/40 flex items-center justify-center text-secondary font-extrabold text-lg shadow-sm">K</div>
            <div>
              <span className="font-extrabold text-md tracking-tight block">HospitalityOS Kitchen</span>
              <span className="text-[10px] text-text/50 block font-semibold uppercase tracking-wider">Prep Ticket Terminal</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-border/20">
            {navItems.map(item => {
              const isSelected = activeRoute === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-secondary/10 border-secondary text-secondary'
                      : 'bg-transparent border-transparent text-text/50 hover:bg-surface/30'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-bg border border-border rounded-xl px-3 py-1.5">
            <span className="text-xs font-bold text-text hidden sm:inline">{user?.name}</span>
            <span className="text-[9px] font-black tracking-wider uppercase text-secondary bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">KITCHEN</span>
            <select
              value={user?.role}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              className="bg-surface/50 border border-border/40 text-[10px] font-bold text-text/60 rounded px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="WAITER">WAITER</option>
              <option value="KITCHEN">KITCHEN</option>
              <option value="USER">USER</option>
            </select>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all" title="Log Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex sm:hidden items-center justify-around border-b border-border/10 bg-surface/50 p-2">
        {navItems.map(item => {
          const isSelected = activeRoute === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                isSelected ? 'bg-secondary/20 text-secondary' : 'text-text/50'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-bg/25">
        <Outlet />
      </main>
    </div>
  );
}

function UserLayout() {
  const { user, logout, loginAs } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleRoleSwitch = async (role: string) => {
    await loginAs(role);
    const sessionUser = useAuthStore.getState().user;
    if (sessionUser) {
      navigate(getPanelPath(sessionUser.role));
    }
  };

  const activeRoute = location.pathname;
  const navItems = [
    { path: '/user', label: 'Profile', icon: UserIcon },
    { path: '/user/bookings', label: 'Bookings', icon: Calendar },
    { path: '/user/invoices', label: 'Invoices', icon: DollarSign },
    { path: '/user/room-services', label: 'Room Service Requests', icon: Coffee },
    { path: '/user/restaurant-orders', label: 'Restaurant Orders', icon: ShoppingCart },
    { path: '/user/notifications', label: 'Notifications', icon: Bell }
  ];

  return (
    <div className="min-h-screen bg-bg text-text transition-colors duration-200 flex flex-col">
      <header className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-extrabold text-lg shadow-sm">U</div>
          <div>
            <span className="font-extrabold text-md tracking-tight block">HospitalityOS Guest</span>
            <span className="text-[10px] text-text/50 block font-semibold uppercase tracking-wider">Guest Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-bg border border-border rounded-xl px-3 py-1.5">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-text">{user?.name}</span>
              <span className="text-[9px] font-black tracking-wider uppercase text-primary">USER PANEL</span>
            </div>
            <select
              value={user?.role}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              className="bg-surface/50 border border-border/40 text-[10px] font-bold text-text/60 rounded px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="WAITER">WAITER</option>
              <option value="KITCHEN">KITCHEN</option>
              <option value="USER">USER</option>
            </select>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all" title="Log Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-64 border-r border-border bg-surface/50 p-4 space-y-2 flex-shrink-0">
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-text/30 px-3 pb-2">Guest Navigation</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeRoute === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 font-bold text-xs px-4 py-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-sm'
                    : 'bg-transparent border-transparent text-text/75 hover:bg-surface/65'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </aside>
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-bg/25">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { fetchTheme, isLoading: isThemeLoading } = useThemeStore();

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  if (isThemeLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-text">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm font-bold tracking-wider uppercase">Loading Workspace Resources...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

// -------------------------------------------------------------
// APP ROUTING & CORE LOGIC
// -------------------------------------------------------------
function AppRoutes() {
  const { token, user, login, loginAs, error: authError, isLoading: isAuthLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Auth States for Gateway View
  const [authState, setAuthState] = useState<'login' | 'signup' | 'pending'>(() => {
    const pendingSignup = localStorage.getItem('auth_signup_pending') === 'true';
    if (window.location.pathname === '/signup') {
      return pendingSignup ? 'pending' : 'signup';
    }
    return 'login';
  });
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<'MANAGER' | 'WAITER' | 'KITCHEN'>('WAITER');
  const [signupError, setSignupError] = useState<string | null>(null);

  // Redirect to correct workspace root on initial load if logged in
  useEffect(() => {
    if (token && user && window.location.pathname === '/') {
      redirectToPanel(user.role);
    }
  }, [token, user]);

  useEffect(() => {
    if (location.pathname === '/signup') {
      setAuthState(localStorage.getItem('auth_signup_pending') === 'true' ? 'pending' : 'signup');
      setLoginError(null);
    } else if (location.pathname === '/login') {
      setAuthState('login');
      setSignupError(null);
      localStorage.removeItem('auth_signup_pending');
    }
  }, [location.pathname]);

  const redirectToPanel = (role: string) => {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      navigate('/admin');
    } else if (role === 'MANAGER') {
      navigate('/manager');
    } else if (role === 'WAITER') {
      navigate('/waiter');
    } else if (role === 'KITCHEN') {
      navigate('/kitchen');
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(loginEmail, loginPassword);
      const sessionUser = useAuthStore.getState().user;
      if (sessionUser) {
        // If admin/manager and demo selection not chosen, show demo selector first
        const demoChosen = localStorage.getItem('demo_selected');
        if ((sessionUser.role === 'ADMIN' || sessionUser.role === 'MANAGER') && !demoChosen) {
          navigate('/demo');
        } else {
          redirectToPanel(sessionUser.role);
        }
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleSignupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (!signupName || !signupEmail || !signupPassword) {
      setSignupError('Name, email, and password are required');
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          phone: signupPhone,
          password: signupPassword,
          role: signupRole
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Registration failed');
      }

      localStorage.setItem('auth_signup_pending', 'true');
      setAuthState('pending');
    } catch (err: any) {
      setSignupError(err.message || 'Registration failed');
    }
  };

  const handleDemoLogin = async (role: string) => {
    try {
      await loginAs(role);
      const sessionUser = useAuthStore.getState().user;
      if (sessionUser) {
        redirectToPanel(sessionUser.role);
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Demo login failed');
    }
  };

  // -------------------------------------------------------------
  // ROUTE GUARDS
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // REVERSE ROUTE GUARD & PUBLIC PATH WRAPPERS
  // -------------------------------------------------------------
  const loginPageMarkup = (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-text p-6">
      <div className="bg-surface/40 border border-border/30 rounded-3xl p-8 max-w-md w-full shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-surface font-black text-xl mx-auto shadow-lg">H</div>
          <h1 className="text-xl font-black tracking-tight">HospitalityOS Gateway</h1>
          <p className="text-xs text-text/50">Enter credentials to unlock your property portal.</p>
        </div>

        {(loginError || authError) && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-400 p-3.5 rounded-xl text-xs text-center font-semibold">{loginError || authError}</div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off" spellCheck={false}>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-text/30" />
              <input
                type="email"
                autoComplete="username"
                required
                placeholder="name@property.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl pl-10 pr-4 py-3 text-text focus:outline-none focus:border-primary placeholder-text/30"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-text/30" />
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl pl-10 pr-4 py-3 text-text focus:outline-none focus:border-primary placeholder-text/30"
              />
            </div>
          </div>

          <button type="submit" disabled={isAuthLoading} className="w-full bg-primary hover:bg-primary-hover text-surface font-black text-xs py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
            {isAuthLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Key className="w-4 h-4" />Sign In to System</>}
          </button>
        </form>

        <div className="text-center pt-2">
          <button onClick={() => { setSignupError(null); setAuthState('signup'); navigate('/signup'); }} className="text-[11px] font-bold text-primary hover:underline">
            Don't have an account? Request access here
          </button>
        </div>

        <div className="border-t border-border/20 pt-4 space-y-3">
          <span className="text-[9px] font-black uppercase text-text/30 block text-center tracking-widest">Demo Sandbox Profiles</span>
          <div className="grid grid-cols-2 gap-2">
            {(['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN'] as const).map(role => (
              <button
                key={role}
                onClick={() => handleDemoLogin(role)}
                className="bg-surface/50 border border-border/40 hover:border-primary/50 text-[10px] font-bold py-2 rounded-xl text-center transition-all hover:bg-surface-hover"
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const signupPageMarkup = (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-text p-6">
      <div className="bg-surface/40 border border-border/30 rounded-3xl p-8 max-w-md w-full shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-surface font-black text-xl mx-auto shadow-lg">H</div>
          <h1 className="text-xl font-black tracking-tight">Create HospitalityOS Account</h1>
          <p className="text-xs text-text/50">Register to submit an access request to your property manager.</p>
        </div>

        {signupError && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-400 p-3.5 rounded-xl text-xs">{signupError}</div>
        )}

        <form onSubmit={handleSignupSubmit} className="space-y-4" autoComplete="off" spellCheck={false}>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Full Name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 w-4 h-4 text-text/30" />
              <input
                type="text"
                autoComplete="name"
                required
                placeholder="Enter your name"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl pl-10 pr-4 py-3 text-text focus:outline-none focus:border-primary placeholder-text/30"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-text/30" />
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="name@property.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl pl-10 pr-4 py-3 text-text focus:outline-none focus:border-primary placeholder-text/30"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Phone Number (Optional)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-text/30" />
              <input
                type="tel"
                autoComplete="tel"
                placeholder="+1 (555) 000-0000"
                value={signupPhone}
                onChange={(e) => setSignupPhone(e.target.value)}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl pl-10 pr-4 py-3 text-text focus:outline-none focus:border-primary placeholder-text/30"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Requested Position</label>
            <select
              value={signupRole}
              onChange={(e: any) => setSignupRole(e.target.value)}
              className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-3 py-3 text-text focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="WAITER">WAITER (Service Staff)</option>
              <option value="KITCHEN">KITCHEN (Prep & Chef)</option>
              <option value="MANAGER">MANAGER (Outlet Manager)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text/40 tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-text/30" />
              <input
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl pl-10 pr-4 py-3 text-text focus:outline-none focus:border-primary placeholder-text/30"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-surface font-black text-xs py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Submit Access Request
          </button>
        </form>

        <div className="text-center pt-2">
          <button onClick={() => { setLoginError(null); setAuthState('login'); navigate('/login'); }} className="text-[11px] font-bold text-primary hover:underline">
            Already have an account? Log in here
          </button>
        </div>
      </div>
    </div>
  );

  const pendingPageMarkup = (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-text p-6">
      <div className="bg-surface/40 border border-border/30 rounded-3xl p-8 max-w-md w-full shadow-2xl backdrop-blur-md space-y-6 text-center">
        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
        <div className="space-y-2">
          <h2 className="text-xl font-black">Registration Request Sent!</h2>
          <p className="text-xs text-text/60 leading-relaxed">
            Your account is currently <strong className="text-primary uppercase">PENDING</strong> manager review. Please contact your outlet administrator to approve your credentials.
          </p>
        </div>
        <button onClick={() => { setLoginError(null); setAuthState('login'); localStorage.removeItem('auth_signup_pending'); navigate('/login'); }} className="w-full bg-primary hover:bg-primary-hover text-surface font-black text-xs py-3 rounded-xl transition-all shadow-md">
          Back to Login Gate
        </button>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // ROUTE REGISTRATION TREE (React Router)
  // -------------------------------------------------------------
  return (
    <Routes>
      <Route path="/" element={<RootRedirector />} />
      <Route path="/login" element={<PublicOnlyRoute>{loginPageMarkup}</PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute>{authState === 'pending' ? pendingPageMarkup : signupPageMarkup}</PublicOnlyRoute>} />

      {/* Demo selector for Admin/Manager to choose business module */}
      <Route element={<AuthGuard />}>
        <Route element={<RoleGuard allowedRoles={['ADMIN', 'MANAGER']} />}>
          <Route path="/demo" element={<DemoSelector />} />
        </Route>
      </Route>

      {/* Secure Auth & Role Guards wrapper */}
      <Route element={<AuthGuard />}>
        
        {/* ADMIN Group */}
        <Route element={<RoleGuard allowedRoles={['ADMIN', 'SUPER_ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<DashboardOverview />} />
            <Route path="/admin/hotel" element={<HotelDashboardPage />} />
            <Route path="/admin/hotel/bookings" element={<HotelBookingsPage />} />
            <Route path="/admin/hotel/rooms" element={<RoomManagementPage />} />
            <Route path="/admin/hotel/check-in-out" element={<CheckInOutPage />} />
            <Route path="/admin/hotel/room-service" element={<RoomServicePage />} />
            <Route path="/admin/cafe" element={<CafeBarPage />} />
            <Route path="/admin/bar" element={<CafeBarPage />} />
            <Route path="/admin/banquet" element={<BanquetPage />} />
            <Route path="/admin/retro" element={<HotelDashboardPage />} />
            <Route path="/admin/restaurant/orders" element={<OrderPage />} />
            <Route path="/admin/restaurant/kitchen" element={<KitchenQueuePage />} />
            
            <Route path="/admin/staff" element={<RosterPage />} />
            <Route path="/admin/attendance" element={<AttendancePage defaultTab="scan" />} />
            <Route path="/admin/menu" element={<MenuPage />} />
            <Route path="/admin/reservations" element={<ReservationsPage />} />
            <Route path="/admin/salary" element={<SalaryPage />} />
            <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
            <Route path="/admin/settings" element={<PropertySettingsPage />} />
            <Route path="/admin/branding" element={<ThemeEditor />} />
          </Route>
        </Route>

        {/* MANAGER Group */}
        <Route element={<RoleGuard allowedRoles={['MANAGER']} />}>
          <Route element={<ManagerLayout />}>
            <Route path="/manager" element={<DashboardOverview />} />
            <Route path="/manager/hotel" element={<HotelDashboardPage />} />
            <Route path="/manager/hotel/bookings" element={<HotelBookingsPage />} />
            <Route path="/manager/hotel/rooms" element={<RoomManagementPage />} />
            <Route path="/manager/hotel/check-in-out" element={<CheckInOutPage />} />
            <Route path="/manager/hotel/room-service" element={<RoomServicePage />} />
            <Route path="/manager/cafe" element={<CafeBarPage />} />
            <Route path="/manager/bar" element={<CafeBarPage />} />
            <Route path="/manager/banquet" element={<BanquetPage />} />
            <Route path="/manager/retro" element={<HotelDashboardPage />} />
            <Route path="/manager/restaurant/orders" element={<OrderPage />} />
            <Route path="/manager/restaurant/kitchen" element={<KitchenQueuePage />} />
            
            <Route path="/manager/staff" element={<RosterPage />} />
            <Route path="/manager/attendance" element={<AttendancePage defaultTab="scan" />} />
            <Route path="/manager/menu" element={<MenuPage />} />
            <Route path="/manager/reservations" element={<ReservationsPage />} />
            <Route path="/manager/leaves" element={<AttendancePage defaultTab="approvals" />} />
          </Route>
        </Route>

        {/* WAITER Group */}
        <Route element={<RoleGuard allowedRoles={['WAITER']} />}>
          <Route element={<WaiterLayout />}>
            <Route path="/waiter" element={<OrderPage />} />
            <Route path="/waiter/qr" element={<AttendancePage defaultTab="my-qr" />} />
            <Route path="/waiter/leaves" element={<AttendancePage defaultTab="my-leaves" />} />
            <Route path="/waiter/reservations" element={<ReservationsPage />} />
          </Route>
        </Route>

        {/* KITCHEN Group */}
        <Route element={<RoleGuard allowedRoles={['KITCHEN']} />}>
          <Route element={<KitchenLayout />}>
            <Route path="/kitchen" element={<KitchenQueuePage />} />
            <Route path="/kitchen/qr" element={<AttendancePage defaultTab="my-qr" />} />
            <Route path="/kitchen/leaves" element={<AttendancePage defaultTab="my-leaves" />} />
          </Route>
        </Route>

        {/* USER Group */}
        <Route element={<RoleGuard allowedRoles={['USER']} />}>
          <Route element={<UserLayout />}>
            <Route path="/user" element={<UserPanelPage />} />
            <Route path="/user/bookings" element={<UserPanelPage />} />
            <Route path="/user/invoices" element={<UserPanelPage />} />
            <Route path="/user/room-services" element={<UserPanelPage />} />
            <Route path="/user/restaurant-orders" element={<UserPanelPage />} />
            <Route path="/user/notifications" element={<UserPanelPage />} />
          </Route>
        </Route>

      </Route>

      {/* Catch-all unknown paths redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
