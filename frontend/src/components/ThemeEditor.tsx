import React, { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { 
  Paintbrush, 
  Upload, 
  RotateCcw, 
  History, 
  Check, 
  AlertTriangle, 
  Sun, 
  Moon, 
  Eye, 
  Layout, 
  Settings,
  RefreshCw,
  Info
} from 'lucide-react';
import { useThemeStore, ThemeConfig, DEFAULT_THEME } from '../store/themeStore';
import { hexToHsl, hslToHex, checkContrastAA, getOptimalTextColor, parseHslString } from '../utils/contrast';

// Predefined Theme Templates for Quick Configuration
const PRESETS = [
  {
    name: "Classic Indigo (Default)",
    theme: DEFAULT_THEME
  },
  {
    name: "Emerald Eco Resort",
    theme: {
      ...DEFAULT_THEME,
      primary: "142 70% 45%",       // Emerald Green
      secondary: "160 84% 39%",
      btn: "142 70% 45%",
      btnHover: "142 70% 37%",
      btnActive: "142 70% 29%",
      btnDisabled: "142 10% 80%"
    }
  },
  {
    name: "Midnight Crimson",
    theme: {
      ...DEFAULT_THEME,
      primary: "346 84% 61%",       // Crimson Rose
      secondary: "262 83% 58%",     // Purple Accent
      btn: "346 84% 61%",
      btnHover: "346 84% 53%",
      btnActive: "346 84% 45%",
      btnDisabled: "346 10% 80%"
    }
  },
  {
    name: "Golden Amber Cafe",
    theme: {
      ...DEFAULT_THEME,
      primary: "38 92% 50%",        // Amber Yellow
      secondary: "25 95% 53%",      // Orange
      btn: "38 92% 50%",
      btnHover: "38 92% 42%",
      btnActive: "38 92% 34%",
      btnDisabled: "38 10% 80%"
    }
  }
];

export default function ThemeEditor() {
  const { 
    theme, 
    isDarkMode, 
    logoUrl, 
    tenantName, 
    themeVersions, 
    isLoading, 
    error,
    setTheme, 
    setLogoUrl, 
    toggleDarkMode, 
    saveTheme, 
    revertTheme, 
    resetToDefault 
  } = useThemeStore();

  const [activeTokenKey, setActiveTokenKey] = useState<keyof ThemeConfig>('primary');
  const [hexColor, setHexColor] = useState('#3b82f6');
  const [autoDerive, setAutoDerive] = useState(true);
  const [contrastStatus, setContrastStatus] = useState<{
    lightPass: boolean;
    lightRatio: number;
    darkPass: boolean;
    darkRatio: number;
    btnPass: boolean;
    btnRatio: number;
  }>({ lightPass: true, lightRatio: 21, darkPass: true, darkRatio: 21, btnPass: true, btnRatio: 21 });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Sync state with store color
  useEffect(() => {
    const activeColorVal = theme[activeTokenKey];
    setHexColor(hslToHex(activeColorVal));
  }, [activeTokenKey, theme]);

  // Recalculate Contrast
  useEffect(() => {
    const lightCheck = checkContrastAA(theme.textLight, theme.bgLight);
    const darkCheck = checkContrastAA(theme.textDark, theme.bgDark);
    
    // Check contrast of optimal text on active button color
    const optimalBtnText = getOptimalTextColor(theme.btn);
    const btnCheck = checkContrastAA(optimalBtnText, theme.btn);

    setContrastStatus({
      lightPass: lightCheck.pass,
      lightRatio: parseFloat(lightCheck.ratio.toFixed(2)),
      darkPass: darkCheck.pass,
      darkRatio: parseFloat(darkCheck.ratio.toFixed(2)),
      btnPass: btnCheck.pass,
      btnRatio: parseFloat(btnCheck.ratio.toFixed(2))
    });
  }, [theme]);

  // Handle color change from Picker
  const handleColorChange = (newHex: string) => {
    setHexColor(newHex);
    const hslVal = hexToHsl(newHex);

    if (activeTokenKey === 'primary' && autoDerive) {
      // Parse HSL to derive shades
      const parsed = parseHslString(hslVal);
      const hoverLightness = Math.max(parsed.l - 8, 0);
      const activeLightness = Math.max(parsed.l - 16, 0);
      const disabledLightness = isDarkMode ? 30 : 80;
      
      setTheme({
        primary: hslVal,
        btn: hslVal,
        btnHover: `${parsed.h} ${parsed.s}% ${hoverLightness}%`,
        btnActive: `${parsed.h} ${parsed.s}% ${activeLightness}%`,
        btnDisabled: `${parsed.h} 10% ${disabledLightness}%`
      });
    } else {
      setTheme({ [activeTokenKey]: hslVal });
    }
  };

  // Logo upload handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Local client-side preview
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Send to backend
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const response = await fetch(`/api/theme/${useThemeStore.getState().tenantId}/upload-logo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setLogoUrl(data.logoUrl);
    } catch (err: any) {
      alert("Error uploading logo: " + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Save changes
  const handleSave = async () => {
    try {
      await saveTheme();
      alert("Theme settings saved successfully!");
    } catch (err: any) {
      alert("Failed to save theme config: " + err.message);
    }
  };

  const tokenLabels: Record<keyof ThemeConfig, string> = {
    primary: "Primary Brand Color",
    secondary: "Secondary/Accent Color",
    bgLight: "Light Background",
    bgDark: "Dark Background",
    surfaceLight: "Light Surface Card",
    surfaceDark: "Dark Surface Card",
    textLight: "Light Mode Text",
    textDark: "Dark Mode Text",
    btn: "Button Primary",
    btnHover: "Button Hover State",
    btnActive: "Button Active State",
    btnDisabled: "Button Disabled State",
    borderLight: "Light Mode Borders",
    borderDark: "Dark Mode Borders",
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6 lg:p-8">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">HospitalityOS White-Label Engine</h1>
          <p className="text-text/70 mt-1">Configure {tenantName}'s visual branding. Changes apply immediately across all client devices.</p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button 
            onClick={toggleDarkMode}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl font-semibold bg-surface hover:bg-border transition-all active:scale-95 duration-150"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold bg-primary text-surface hover:brightness-95 active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            {isLoading ? "Saving..." : "Save Branding"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Hand Customization Panel */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Preset templates */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Paintbrush className="w-5 h-5 text-primary" />
              Predefined Brand Templates
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTheme(preset.theme);
                    setActiveTokenKey('primary');
                  }}
                  className="flex flex-col items-center justify-between p-3 border border-border rounded-xl hover:border-primary bg-bg/50 hover:bg-bg transition-all"
                >
                  <div className="flex gap-1.5 mb-2">
                    <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: hslToHex(preset.theme.primary) }} />
                    <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: hslToHex(preset.theme.secondary) }} />
                    <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: hslToHex(preset.theme.bgLight) }} />
                  </div>
                  <span className="text-xs font-semibold text-center">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Core styling options */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Design Token Customization
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Token List */}
              <div className="md:col-span-6 space-y-2 max-h-[420px] overflow-y-auto pr-2">
                {Object.keys(tokenLabels).map((key) => {
                  const tokenKey = key as keyof ThemeConfig;
                  const isActive = activeTokenKey === tokenKey;
                  const colorVal = theme[tokenKey];
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTokenKey(tokenKey)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                        isActive 
                          ? 'border-primary bg-primary/10 font-bold' 
                          : 'border-border hover:bg-bg/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span 
                          className="w-5 h-5 rounded-full border border-black/10 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: hslToHex(colorVal) }}
                        />
                        <span className="text-sm truncate">{tokenLabels[tokenKey]}</span>
                      </div>
                      <span className="text-xs text-text/50 font-mono select-all shrink-0">
                        {colorVal}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Color Wheel & Sliders */}
              <div className="md:col-span-6 flex flex-col items-center justify-center p-4 border border-border rounded-xl bg-bg/20">
                <p className="text-sm font-semibold mb-3 self-start">{tokenLabels[activeTokenKey]}</p>
                <div className="w-full flex justify-center mb-4">
                  <HexColorPicker color={hexColor} onChange={handleColorChange} className="!w-full !max-w-[200px] !h-[200px]" />
                </div>
                
                {activeTokenKey === 'primary' && (
                  <label className="flex items-center gap-2 bg-bg/50 px-3 py-1.5 rounded-lg border border-border w-full text-xs font-semibold cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoDerive} 
                      onChange={(e) => setAutoDerive(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>Auto-derive button hover/active shades</span>
                  </label>
                )}

                <div className="mt-3 w-full flex items-center justify-between bg-bg/60 border border-border px-3 py-2 rounded-xl">
                  <span className="text-xs font-bold font-mono text-text/75">{hexColor.toUpperCase()}</span>
                  <input
                    type="text"
                    value={hexColor}
                    onChange={(e) => {
                      if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                        handleColorChange(e.target.value);
                      } else {
                        setHexColor(e.target.value);
                      }
                    }}
                    className="w-20 bg-transparent border-b border-border focus:border-primary text-xs font-mono font-bold text-right outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Logo uploader */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Brand Logo & Favicon
            </h3>
            <p className="text-xs text-text/70 mb-4">Upload an SVG or PNG brand image. HospitalityOS will automatically compute favicon templates and insert the logo onto billing headers, reservation emails, and login screens.</p>
            
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-32 h-32 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center bg-bg/30 relative overflow-hidden flex-shrink-0">
                {logoPreview || logoUrl ? (
                  <img 
                    src={logoPreview || logoUrl || undefined} 
                    alt="Logo preview" 
                    className="max-w-[90%] max-h-[90%] object-contain" 
                  />
                ) : (
                  <Layout className="w-8 h-8 text-text/30" />
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-surface/70 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 w-full space-y-3">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleLogoUpload}
                  id="logo-file-input"
                  className="hidden" 
                />
                <div className="flex flex-wrap gap-2">
                  <label 
                    htmlFor="logo-file-input"
                    className="cursor-pointer px-4 py-2 border border-border rounded-xl font-bold bg-surface hover:bg-bg transition-all text-xs"
                  >
                    Select File
                  </label>
                  {(logoPreview || logoUrl) && (
                    <button
                      onClick={async () => {
                        setLogoPreview(null);
                        setLogoUrl(null);
                        // Save resetting the logo url
                        const response = await fetch(`/api/theme/${useThemeStore.getState().tenantId}/upload-logo`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ logoUrl: null }),
                        });
                        if (!response.ok) throw new Error("Delete failed");
                      }}
                      className="px-4 py-2 border border-red-500/20 text-red-500 rounded-xl font-bold hover:bg-red-500/10 transition-all text-xs"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-text/50">Recommended: Square format, SVG or transparent PNG, max 2MB.</p>
              </div>
            </div>
          </div>

          {/* WCAG Contrast check and actions */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              WCAG 2.0 AA Compliance Audit
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-bg/50 border border-border">
                <div>
                  <p className="text-sm font-bold">Normal Text Contrast (Light Mode)</p>
                  <p className="text-xs text-text/60">Contrast ratio between text and light background (Min: 4.5)</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${contrastStatus.lightPass ? 'bg-green-500/10 text-green-500 border border-green-500/25' : 'bg-red-500/10 text-red-500 border border-red-500/25'}`}>
                  {contrastStatus.lightRatio} : 1 ({contrastStatus.lightPass ? 'Pass' : 'Fail'})
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-bg/50 border border-border">
                <div>
                  <p className="text-sm font-bold">Normal Text Contrast (Dark Mode)</p>
                  <p className="text-xs text-text/60">Contrast ratio between text and dark background (Min: 4.5)</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${contrastStatus.darkPass ? 'bg-green-500/10 text-green-500 border border-green-500/25' : 'bg-red-500/10 text-red-500 border border-red-500/25'}`}>
                  {contrastStatus.darkRatio} : 1 ({contrastStatus.darkPass ? 'Pass' : 'Fail'})
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-bg/50 border border-border">
                <div>
                  <p className="text-sm font-bold">Button Overlay Contrast</p>
                  <p className="text-xs text-text/60">Calculated readability overlay on active brand buttons (Min: 4.5)</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${contrastStatus.btnPass ? 'bg-green-500/10 text-green-500 border border-green-500/25' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/25'}`}>
                  {contrastStatus.btnRatio} : 1 ({contrastStatus.btnPass ? 'Pass' : 'Acceptable'})
                </div>
              </div>

              {!contrastStatus.lightPass && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-500 rounded-xl text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Your light text color does not contrast well with the light background. This may violate accessibility standards. We recommend picking a darker text color or a lighter background.</span>
                </div>
              )}
              {!contrastStatus.darkPass && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-500 rounded-xl text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Your dark text color does not contrast well with the dark background. This may violate accessibility standards. We recommend picking a lighter text color or a darker background.</span>
                </div>
              )}
            </div>
          </div>

          {/* Theme Version History & Reset to Default */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Theme Configuration History
              </h3>
              <button 
                onClick={resetToDefault}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 font-bold transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
            </div>

            {themeVersions.length === 0 ? (
              <p className="text-xs text-text/50 py-4 text-center border border-dashed border-border rounded-xl">No saved history. Make changes and save to create versions.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {themeVersions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between p-2.5 bg-bg/50 border border-border rounded-xl hover:bg-bg transition-all">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: hslToHex(version.primary) }} />
                        <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: hslToHex(version.secondary) }} />
                      </div>
                      <span className="text-xs text-text/75">{new Date(version.createdAt).toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => revertTheme(version.id)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Revert
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Hand Live Application Preview Pane */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-6 p-6 rounded-2xl bg-surface border border-border shadow-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Live Interactive Preview
            </h3>
            
            {/* Embedded Mini App Mockup */}
            <div className="w-full border border-border rounded-2xl overflow-hidden shadow-inner bg-bg flex flex-col min-h-[580px]">
              
              {/* Mock App Header */}
              <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {logoUrl || logoPreview ? (
                    <img src={logoPreview || logoUrl || undefined} alt="Preview logo" className="h-6 object-contain" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-[10px] text-surface font-extrabold">H</div>
                  )}
                  <span className="text-sm font-extrabold tracking-tight">HospitalityOS</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-text/50 font-semibold uppercase">Realtime Kitchen</span>
                </div>
              </div>

              {/* Mock Dashboard Layout */}
              <div className="flex-1 p-4 space-y-4">
                
                {/* Section Title */}
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text/60">Overview Dashboard</h4>
                  <span className="text-[10px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-md">Table POS active</span>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface border border-border rounded-xl shadow-sm">
                    <p className="text-[10px] text-text/60 font-semibold">Today's Bookings</p>
                    <p className="text-lg font-bold mt-1 text-primary">12 Reservations</p>
                  </div>
                  <div className="p-3 bg-surface border border-border rounded-xl shadow-sm">
                    <p className="text-[10px] text-text/60 font-semibold">Gross Profit</p>
                    <p className="text-lg font-bold mt-1 text-secondary">₹18,450.00</p>
                  </div>
                </div>

                {/* Sample KOT Order Version Snapshot */}
                <div className="p-3 bg-surface border border-border rounded-xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="text-xs font-bold text-text">KOT: #104 (Table 5)</span>
                    <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-bold uppercase">Pre-Paid Deposit</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text/75">1x Butter Chicken Combo (Dine-in)</span>
                      <span className="font-semibold">₹350.00</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text/75">2x Fresh Lime Soda (Takeaway)</span>
                      <span className="font-semibold">₹160.00</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <button className="flex-1 bg-btn hover:bg-btn-hover text-xs font-bold py-1.5 px-3 rounded-lg text-center transition-all shadow-sm" style={{ color: hslToHex(getOptimalTextColor(theme.btn)) }}>
                      KOT Complete
                    </button>
                    <button className="px-2 border border-border rounded-lg text-text/60 hover:bg-bg/50">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Billing Invoice Preview Component */}
                <div className="p-4 bg-surface border border-border rounded-xl shadow-sm font-mono space-y-3">
                  <div className="text-center border-b border-dashed border-border pb-2">
                    <div className="flex justify-center mb-1">
                      {logoUrl || logoPreview ? (
                        <img src={logoPreview || logoUrl || undefined} alt="Invoice logo" className="h-5 object-contain" />
                      ) : (
                        <span className="font-bold text-xs uppercase tracking-widest">{tenantName}</span>
                      )}
                    </div>
                    <p className="text-[8px] text-text/60">GSTIN: 27AAAAA1111A1Z1 • TAX INVOICE</p>
                  </div>
                  
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>Room 204: Deluxe Suite (2 nights)</span>
                      <span>₹8,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CGST @ 9%</span>
                      <span>₹720.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST @ 9%</span>
                      <span>₹720.00</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-dashed border-border pt-1.5 text-xs text-primary">
                      <span>Total Due</span>
                      <span>₹9,440.00</span>
                    </div>
                  </div>
                </div>

                {/* UI Element states */}
                <div className="space-y-2">
                  <p className="text-[10px] text-text/50 font-bold uppercase tracking-wider">Button State Variants</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-btn hover:bg-btn-hover text-xs py-1.5 px-3 rounded-lg font-bold transition-all shadow" style={{ color: hslToHex(getOptimalTextColor(theme.btn)) }}>
                      Hover (Active)
                    </button>
                    <button className="bg-btn-active text-xs py-1.5 px-3 rounded-lg font-bold transition-all shadow" style={{ color: hslToHex(getOptimalTextColor(theme.btnActive)) }}>
                      Pressed
                    </button>
                    <button className="bg-btn-disabled text-xs py-1.5 px-3 rounded-lg font-bold cursor-not-allowed text-text/40" disabled>
                      Disabled
                    </button>
                    <button className="border border-border text-xs py-1.5 px-3 rounded-lg font-bold hover:bg-bg/40 text-text">
                      Outline Mode
                    </button>
                  </div>
                </div>

              </div>
              
              {/* Footer status bar */}
              <div className="bg-surface border-t border-border px-4 py-2 flex items-center justify-between text-[10px] text-text/50 font-bold">
                <span>HospitalityOS v1.0.0</span>
                <span>Tenant Profile: active</span>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
