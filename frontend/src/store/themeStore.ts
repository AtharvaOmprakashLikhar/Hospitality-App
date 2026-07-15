import { create } from 'zustand';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  bgLight: string;
  bgDark: string;
  surfaceLight: string;
  surfaceDark: string;
  textLight: string;
  textDark: string;
  btn: string;
  btnHover: string;
  btnActive: string;
  btnDisabled: string;
  borderLight: string;
  borderDark: string;
}

export interface ThemeVersion {
  id: string;
  primary: string;
  secondary: string;
  bgLight: string;
  bgDark: string;
  surfaceLight: string;
  surfaceDark: string;
  textLight: string;
  textDark: string;
  btn: string;
  btnHover: string;
  btnActive: string;
  btnDisabled: string;
  borderLight: string;
  borderDark: string;
  createdAt: string;
}

interface ThemeState {
  theme: ThemeConfig;
  isDarkMode: boolean;
  logoUrl: string | null;
  tenantName: string;
  tenantId: string;
  themeVersions: ThemeVersion[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setTheme: (newTheme: Partial<ThemeConfig>) => void;
  setLogoUrl: (url: string | null) => void;
  toggleDarkMode: () => void;
  fetchTheme: (tenantId?: string) => Promise<void>;
  saveTheme: () => Promise<void>;
  revertTheme: (versionId: string) => Promise<void>;
  resetToDefault: () => Promise<void>;
}

export const DEFAULT_THEME: ThemeConfig = {
  primary: "220 90% 56%",
  secondary: "160 84% 39%",
  bgLight: "210 20% 98%",
  bgDark: "224 71% 4%",
  surfaceLight: "0 0% 100%",
  surfaceDark: "224 71% 8%",
  textLight: "220 15% 10%",
  textDark: "210 20% 98%",
  btn: "220 90% 56%",
  btnHover: "220 90% 48%",
  btnActive: "220 90% 40%",
  btnDisabled: "220 10% 80%",
  borderLight: "220 12% 90%",
  borderDark: "220 12% 20%",
};

export const applyThemeToDom = (theme: ThemeConfig, isDark: boolean) => {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', theme.primary);
  root.style.setProperty('--color-secondary', theme.secondary);
  root.style.setProperty('--color-bg', isDark ? theme.bgDark : theme.bgLight);
  root.style.setProperty('--color-surface', isDark ? theme.surfaceDark : theme.surfaceLight);
  root.style.setProperty('--color-text', isDark ? theme.textDark : theme.textLight);
  root.style.setProperty('--color-btn', theme.btn);
  root.style.setProperty('--color-btn-hover', theme.btnHover);
  root.style.setProperty('--color-btn-active', theme.btnActive);
  root.style.setProperty('--color-btn-disabled', theme.btnDisabled);
  root.style.setProperty('--color-border', isDark ? theme.borderDark : theme.borderLight);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: { ...DEFAULT_THEME },
  isDarkMode: false,
  logoUrl: null,
  tenantName: "Default Property",
  tenantId: "default-tenant-uuid",
  themeVersions: [],
  isLoading: false,
  error: null,

  setTheme: (newTheme) => {
    const updatedTheme = { ...get().theme, ...newTheme };
    set({ theme: updatedTheme });
    applyThemeToDom(updatedTheme, get().isDarkMode);
  },

  setLogoUrl: (url) => {
    set({ logoUrl: url });
    // Also update favicon if logo exists
    const favicon = document.getElementById('favicon') as HTMLLinkElement;
    if (favicon) {
      favicon.href = url || '/vite.svg';
    }
  },

  toggleDarkMode: () => {
    const nextMode = !get().isDarkMode;
    set({ isDarkMode: nextMode });
    applyThemeToDom(get().theme, nextMode);
    localStorage.setItem('themeMode', nextMode ? 'dark' : 'light');
  },

  fetchTheme: async (tenantId) => {
    set({ isLoading: true, error: null });
    try {
      const id = tenantId || get().tenantId;
      const response = await fetch(`/api/theme/${id}`);
      if (!response.ok) throw new Error("Failed to fetch theme");
      const data = await response.json();
      
      // Load saved mode preference
      const savedMode = localStorage.getItem('themeMode');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = savedMode === 'dark' || (!savedMode && systemPrefersDark);

      const fetchedTheme = {
        primary: data.themeConfig?.primary || DEFAULT_THEME.primary,
        secondary: data.themeConfig?.secondary || DEFAULT_THEME.secondary,
        bgLight: data.themeConfig?.bgLight || DEFAULT_THEME.bgLight,
        bgDark: data.themeConfig?.bgDark || DEFAULT_THEME.bgDark,
        surfaceLight: data.themeConfig?.surfaceLight || DEFAULT_THEME.surfaceLight,
        surfaceDark: data.themeConfig?.surfaceDark || DEFAULT_THEME.surfaceDark,
        textLight: data.themeConfig?.textLight || DEFAULT_THEME.textLight,
        textDark: data.themeConfig?.textDark || DEFAULT_THEME.textDark,
        btn: data.themeConfig?.btn || DEFAULT_THEME.btn,
        btnHover: data.themeConfig?.btnHover || DEFAULT_THEME.btnHover,
        btnActive: data.themeConfig?.btnActive || DEFAULT_THEME.btnActive,
        btnDisabled: data.themeConfig?.btnDisabled || DEFAULT_THEME.btnDisabled,
        borderLight: data.themeConfig?.borderLight || DEFAULT_THEME.borderLight,
        borderDark: data.themeConfig?.borderDark || DEFAULT_THEME.borderDark,
      };

      set({
        theme: fetchedTheme,
        logoUrl: data.logoUrl || null,
        tenantName: data.name,
        tenantId: data.id,
        themeVersions: data.themeVersions || [],
        isDarkMode: isDark,
      });

      applyThemeToDom(fetchedTheme, isDark);
      
      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      if (favicon) {
        favicon.href = data.logoUrl || '/vite.svg';
      }
    } catch (err: any) {
      console.error(err);
      set({ error: err.message || "Failed to load settings" });
      
      // Load system default values as fallback
      const savedMode = localStorage.getItem('themeMode');
      const isDark = savedMode === 'dark';
      set({ isDarkMode: isDark });
      applyThemeToDom(get().theme, isDark);
    } finally {
      set({ isLoading: false });
    }
  },

  saveTheme: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/theme/${get().tenantId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(get().theme),
      });
      if (!response.ok) throw new Error("Failed to save theme");
      const data = await response.json();
      set({ themeVersions: data.themeVersions });
    } catch (err: any) {
      set({ error: err.message || "Failed to save theme" });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  revertTheme: async (versionId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/theme/${get().tenantId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      if (!response.ok) throw new Error("Failed to revert theme");
      const data = await response.json();
      
      const revertedTheme = {
        primary: data.themeConfig.primary,
        secondary: data.themeConfig.secondary,
        bgLight: data.themeConfig.bgLight,
        bgDark: data.themeConfig.bgDark,
        surfaceLight: data.themeConfig.surfaceLight,
        surfaceDark: data.themeConfig.surfaceDark,
        textLight: data.themeConfig.textLight,
        textDark: data.themeConfig.textDark,
        btn: data.themeConfig.btn,
        btnHover: data.themeConfig.btnHover,
        btnActive: data.themeConfig.btnActive,
        btnDisabled: data.themeConfig.btnDisabled,
        borderLight: data.themeConfig.borderLight,
        borderDark: data.themeConfig.borderDark,
      };

      set({
        theme: revertedTheme,
        themeVersions: data.themeVersions,
      });

      applyThemeToDom(revertedTheme, get().isDarkMode);
    } catch (err: any) {
      set({ error: err.message || "Failed to revert theme" });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  resetToDefault: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/theme/${get().tenantId}/reset`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error("Failed to reset theme");
      const data = await response.json();

      set({
        theme: { ...DEFAULT_THEME },
        logoUrl: null,
        themeVersions: data.themeVersions,
      });

      applyThemeToDom(DEFAULT_THEME, get().isDarkMode);

      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      if (favicon) {
        favicon.href = '/vite.svg';
      }
    } catch (err: any) {
      set({ error: err.message || "Failed to reset theme" });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  }
}));
