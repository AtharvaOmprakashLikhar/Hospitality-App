import { create } from 'zustand';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  propertyId: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  propertyId: string | null;
  properties: { id: string; name: string }[];
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  loginAs: (role: string) => Promise<void>;
  logout: () => void;
  fetchProperties: () => Promise<void>;
  setProperty: (propertyId: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  propertyId: localStorage.getItem('propertyId') || 'default-property-uuid',
  properties: [],
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      let responseData: any = null;
      if (text) {
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = null;
        }
      }

      if (!response.ok) {
        const message = responseData?.error || responseData?.message || `Login failed with status ${response.status}`;
        throw new Error(message);
      }

      if (!responseData || !responseData.token) {
        throw new Error('Invalid login response from server');
      }

      localStorage.setItem('token', responseData.token);
      localStorage.setItem('user', JSON.stringify(responseData.user));
      
      const activePropId = responseData.user.propertyId || 'default-property-uuid';
      localStorage.setItem('propertyId', activePropId);

      set({
        token: responseData.token,
        user: responseData.user,
        propertyId: activePropId,
      });

      // Fetch properties lists
      await get().fetchProperties();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  loginAs: async (role) => {
    const roleEmails: Record<string, string> = {
      SUPER_ADMIN: 'superadmin@hospitalityos.com',
      ADMIN: 'atharvalikhar@gmail.com',
      MANAGER: 'manager@hospitalityos.com',
      WAITER: 'waiter@hospitalityos.com',
      KITCHEN: 'kitchen@hospitalityos.com',
    };
    const email = roleEmails[role];
    if (email) {
      const password = role === 'ADMIN' ? '123456789' : 'password123';
      await get().login(email, password);
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('propertyId');
    set({ token: null, user: null, propertyId: null });
  },

  fetchProperties: async () => {
    const token = get().token;
    if (!token) return;
    try {
      // In this version, we fetch properties from menu venues or a config endpoint.
      // Let's call /api/menu/venues (which requires auth) to implicitly get the active property details,
      // or fetch the active property. Since we have a default-property-uuid seeded, we can list it.
      const response = await fetch('/api/menu/venues', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        // If successful, we know the default property is functional.
        // We'll populate properties array:
        set({
          properties: [
            { id: 'default-property-uuid', name: 'Grand Horizon Hotel & Cafe' }
          ]
        });
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    }
  },

  setProperty: (propertyId) => {
    localStorage.setItem('propertyId', propertyId);
    set({ propertyId });
  }
}));
