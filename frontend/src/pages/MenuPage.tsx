import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Coffee, 
  Utensils, 
  Bed, 
  Wine, 
  ShoppingBag, 
  Sliders, 
  Plus, 
  Image as ImageIcon, 
  Edit2, 
  Trash2, 
  UploadCloud, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface MenuItem {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  category: string;
  price: string;
  isVeg: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  corkageAllowed: boolean;
  corkageFee: string | null;
}

interface MenuVenue {
  id: string;
  type: 'CAFE' | 'RESTRO' | 'HOTEL_ROOM_SERVICE' | 'MINI_BAR' | 'BAR' | 'BANQUET' | 'TAKEAWAY';
  name: string;
}

export default function MenuPage() {
  const { token, user } = useAuthStore();
  const isWritable = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Venue Types list
  const venueTypes = [
    { type: 'CAFE', label: 'Cafe', icon: Coffee },
    { type: 'RESTRO', label: 'Restro', icon: Utensils },
    { type: 'HOTEL_ROOM_SERVICE', label: 'Room Service', icon: Bed },
    { type: 'MINI_BAR', label: 'Mini Bar', icon: Sliders },
    { type: 'BAR', label: 'Bar Counter', icon: Wine },
    { type: 'BANQUET', label: 'Banquet Hall', icon: Wine },
    { type: 'TAKEAWAY', label: 'Takeaway', icon: ShoppingBag },
  ];

  const [activeVenueType, setActiveVenueType] = useState<string>('CAFE');
  const [activeVenue, setActiveVenue] = useState<MenuVenue | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Edit / Add Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemCategory, setItemCategory] = useState('Starters');
  const [itemPrice, setItemPrice] = useState('10.00');
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [itemCorkageAllowed, setItemCorkageAllowed] = useState(false);
  const [itemCorkageFee, setItemCorkageFee] = useState('0.00');
  
  // Image uploading
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchVenues = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/menu/venues`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        // Find venue matching selected type
        const match = data.find((v: any) => v.type === activeVenueType);
        if (match) {
          setActiveVenue(match);
        } else {
          // If no venue of this type exists, create a default one for this property
          await createDefaultVenue(activeVenueType);
        }
      }
    } catch {
      setIsLoading(false);
    }
  };

  const createDefaultVenue = async (type: string) => {
    try {
      const name = `${type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')} Outlet`;
      const res = await fetch('/api/menu/venues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, name })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveVenue(data);
      }
    } catch {}
  };

  const fetchItems = async () => {
    if (!activeVenue) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/menu/venues/${activeVenue.id}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        
        // Extract unique categories in order
        const cats = Array.from(new Set<string>(data.map((i: any) => i.category)));
        setCategories(cats.length > 0 ? cats : ['Starters', 'Mains', 'Beverages', 'Desserts']);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, [activeVenueType]);

  useEffect(() => {
    fetchItems();
  }, [activeVenue]);

  // Handle availability toggle
  const toggleAvailability = async (itemId: string, currentVal: boolean) => {
    try {
      const res = await fetch(`/api/menu/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isAvailable: !currentVal })
      });
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, isAvailable: !currentVal } : i));
        showToast('Availability status updated');
      }
    } catch {}
  };

  // Bulk actions: Mark all unavailable
  const markAllUnavailable = async () => {
    if (!activeVenue) return;
    try {
      await Promise.all(
        items.map(i => {
          if (i.isAvailable) {
            return fetch(`/api/menu/items/${i.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ isAvailable: false })
            });
          }
          return Promise.resolve();
        })
      );
      fetchItems();
      showToast('All menu items marked as unavailable.');
    } catch {}
  };

  // Image upload handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Client-side limits check
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image size exceeds 5MB limit');
      return;
    }
    if (!/image\/(jpeg|png|webp)/.test(file.type)) {
      setFormError('Only JPEG, PNG, or WebP formats are supported');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFormError(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!itemName || !itemCategory || !itemPrice) {
      setFormError('Please fill in Name, Category, and Price');
      return;
    }

    try {
      let savedItem: MenuItem;

      if (selectedItem) {
        // Edit Item
        const res = await fetch(`/api/menu/items/${selectedItem.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: itemName,
            description: itemDesc,
            category: itemCategory,
            price: parseFloat(itemPrice),
            isVeg: itemIsVeg,
            isAvailable: itemIsAvailable,
            corkageAllowed: itemCorkageAllowed,
            corkageFee: itemCorkageAllowed ? parseFloat(itemCorkageFee) : null
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to save updates');
        }
        savedItem = await res.json();
      } else {
        // Create Item
        const res = await fetch('/api/menu/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            venueId: activeVenue!.id,
            name: itemName,
            description: itemDesc,
            category: itemCategory,
            price: parseFloat(itemPrice),
            isVeg: itemIsVeg,
            isAvailable: itemIsAvailable,
            corkageAllowed: itemCorkageAllowed,
            corkageFee: itemCorkageAllowed ? parseFloat(itemCorkageFee) : null
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to create item');
        }
        savedItem = await res.json();
      }

      // Handle image upload if selected
      if (imageFile) {
        setUploadProgress(20);
        const formData = new FormData();
        formData.append('image', imageFile);

        setUploadProgress(50);
        const imgRes = await fetch(`/api/menu/items/${savedItem.id}/image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        setUploadProgress(80);
        if (!imgRes.ok) {
          const errData = await imgRes.json();
          throw new Error(errData.error || 'Details saved, but image upload failed');
        }
        setUploadProgress(100);
      }

      showToast(selectedItem ? 'Menu item updated' : 'Menu item created');
      setIsModalOpen(false);
      setImageFile(null);
      setImagePreview(null);
      setUploadProgress(null);
      fetchItems();
    } catch (err: any) {
      setFormError(err.message);
      setUploadProgress(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;

    try {
      const res = await fetch(`/api/menu/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      showToast('Menu item deleted');
      fetchItems();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Category sorting handles
  const handleCategoryMove = (index: number, direction: 'up' | 'down') => {
    const nextIdx = index + (direction === 'up' ? -1 : 1);
    if (nextIdx < 0 || nextIdx >= categories.length) return;
    
    const reordered = [...categories];
    const temp = reordered[index];
    reordered[index] = reordered[nextIdx];
    reordered[nextIdx] = temp;
    setCategories(reordered);
    showToast('Categories reordered');
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-xl font-semibold text-white transition-all flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-secondary' : 'bg-primary'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Outlet types headers */}
      <div className="flex overflow-x-auto gap-2 bg-surface/20 border border-border/20 p-2 rounded-2xl backdrop-blur-md">
        {venueTypes.map(v => {
          const Icon = v.icon;
          return (
            <button
              key={v.type}
              onClick={() => setActiveVenueType(v.type)}
              className={`flex items-center gap-2 text-xs font-bold px-4 py-3 rounded-xl border transition-all flex-shrink-0 ${
                activeVenueType === v.type 
                  ? 'bg-text text-surface border-text shadow-sm' 
                  : 'bg-surface/10 text-text/70 border-border/10 hover:bg-surface/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Actions and details header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <Utensils className="w-6 h-6 text-primary" />
            Active Menu Outlet: {activeVenue?.name || 'Loading...'}
          </h2>
          <p className="text-xs text-text/50">Modify availability status, update dishes, and manage corkages.</p>
        </div>

        {isWritable && (
          <div className="flex gap-2">
            <button
              onClick={markAllUnavailable}
              className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary/20 transition-all"
            >
              Mark All Unavailable
            </button>
            <button
              onClick={() => {
                setSelectedItem(null);
                setItemName('');
                setItemDesc('');
                setItemCategory('Starters');
                setItemPrice('10.00');
                setItemIsVeg(true);
                setItemIsAvailable(true);
                setItemCorkageAllowed(false);
                setItemCorkageFee('0.00');
                setImageFile(null);
                setImagePreview(null);
                setIsModalOpen(true);
              }}
              className="bg-secondary text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Menu Item
            </button>
          </div>
        )}
      </div>

      {/* Grid grouping */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-48 bg-surface/20 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-xs text-text/30 font-bold italic bg-surface/5 border border-dashed border-border/20 rounded-2xl">
          This venue outlet is currently empty. Add your first dish to populate this menu!
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main items listing */}
          <div className="lg:col-span-3 space-y-8">
            {categories.map(cat => {
              const catItems = items.filter(i => i.category === cat);
              if (catItems.length === 0) return null;

              return (
                <div key={cat} className="space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-text/40 border-b border-border/10 pb-1.5">{cat}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {catItems.map(item => (
                      <div 
                        key={item.id} 
                        className={`bg-surface/25 border border-border/30 rounded-2xl p-4 flex gap-4 hover:border-border/60 transition-all ${
                          !item.isAvailable ? 'opacity-65' : ''
                        }`}
                      >
                        {/* Image */}
                        <div className="w-20 h-20 rounded-xl bg-bg border border-border/20 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-text/20" />
                          )}
                          <span className={`absolute top-1 left-1 w-2.5 h-2.5 rounded-full ${
                            item.isVeg ? 'bg-secondary' : 'bg-primary'
                          }`} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-extrabold text-sm truncate">{item.name}</h4>
                              <span className="font-bold text-sm text-secondary">${parseFloat(item.price).toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-text/50 truncate mt-1">{item.description || 'No description provided'}</p>
                            
                            {item.corkageAllowed && (
                              <p className="text-[10px] text-text/45 font-bold mt-1.5 uppercase tracking-wider">
                                Corkage: ${parseFloat(item.corkageFee || '0').toFixed(2)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/10">
                            {/* Availability toggle */}
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold uppercase tracking-wider text-text/60">
                              <input
                                type="checkbox"
                                checked={item.isAvailable}
                                disabled={!isWritable}
                                onChange={() => toggleAvailability(item.id, item.isAvailable)}
                                className="rounded text-primary focus:ring-0 focus:ring-offset-0 border-border/40"
                              />
                              In Stock
                            </label>

                            {/* Writable controls */}
                            {isWritable && (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setItemName(item.name);
                                    setItemDesc(item.description || '');
                                    setItemCategory(item.category);
                                    setItemPrice(item.price);
                                    setItemIsVeg(item.isVeg);
                                    setItemIsAvailable(item.isAvailable);
                                    setItemCorkageAllowed(item.corkageAllowed);
                                    setItemCorkageFee(item.corkageFee || '0.00');
                                    setImageFile(null);
                                    setImagePreview(item.imageUrl);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1.5 rounded hover:bg-surface/40 text-text/60"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1.5 rounded hover:bg-primary/10 text-primary"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar category reordering */}
          <div className="space-y-4">
            <div className="bg-surface/20 border border-border/20 rounded-2xl p-5 backdrop-blur-md">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-text/60 border-b border-border/10 pb-2 mb-4">Category Reordering</h4>
              <div className="space-y-2">
                {categories.map((cat, idx) => (
                  <div key={cat} className="flex items-center justify-between p-2.5 bg-bg/50 border border-border/40 rounded-xl">
                    <span className="text-xs font-bold text-text/80">{cat}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCategoryMove(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 bg-surface hover:bg-surface/50 rounded text-xs font-bold disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleCategoryMove(idx, 'down')}
                        disabled={idx === categories.length - 1}
                        className="p-1 bg-surface hover:bg-surface/50 rounded text-xs font-bold disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-secondary" />
              {selectedItem ? 'Edit Dishes details' : 'Add New Menu Dish'}
            </h2>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4">
              
              {/* Image Drag and Drop Zone */}
              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">Dish Image</label>
                <div className="border-2 border-dashed border-border/40 rounded-2xl p-4 flex flex-col items-center justify-center bg-bg/50 hover:bg-bg transition-all relative">
                  {imagePreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-border" />
                      <button 
                        type="button" 
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="text-[10px] text-primary font-bold hover:underline"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-1.5 w-full">
                      <UploadCloud className="w-8 h-8 text-text/30" />
                      <span className="text-xs text-text/60 font-semibold">Drag files here or click to browse</span>
                      <span className="text-[9px] text-text/40">JPEG, PNG, WebP up to 5MB</span>
                      <input type="file" onChange={handleImageChange} className="hidden" accept="image/*" />
                    </label>
                  )}
                  {uploadProgress !== null && (
                    <div className="w-full bg-border/20 h-1.5 rounded-full overflow-hidden mt-3">
                      <div className="bg-secondary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">Dish Name</label>
                <input
                  type="text"
                  placeholder="e.g. Garlic Truffle Fries"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">Description</label>
                <textarea
                  placeholder="List ingredients or details..."
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text placeholder-text/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text/60 uppercase mb-1">Category</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text font-bold"
                  >
                    <option value="Starters">Starters</option>
                    <option value="Mains">Mains</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text/60 uppercase mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 py-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemIsVeg}
                    onChange={() => setItemIsVeg(!itemIsVeg)}
                    className="rounded text-secondary focus:ring-0"
                  />
                  Vegetarian Dish
                </label>

                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemIsAvailable}
                    onChange={() => setItemIsAvailable(!itemIsAvailable)}
                    className="rounded text-primary focus:ring-0"
                  />
                  Instantly Available
                </label>
              </div>

              {/* Corkage settings (Visible only on BAR and BANQUET) */}
              {(activeVenueType === 'BAR' || activeVenueType === 'BANQUET') && (
                <div className="border-t border-border/20 pt-4 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemCorkageAllowed}
                      onChange={() => setItemCorkageAllowed(!itemCorkageAllowed)}
                      className="rounded text-primary focus:ring-0"
                    />
                    Corkage Allowed
                  </label>

                  {itemCorkageAllowed && (
                    <div>
                      <label className="block text-[10px] font-bold text-text/50 uppercase mb-1">Corkage Fee ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemCorkageFee}
                        onChange={(e) => setItemCorkageFee(e.target.value)}
                        className="bg-bg border border-border rounded-xl p-2.5 text-xs font-bold focus:outline-none w-[180px]"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/20">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-text/60 hover:bg-surface/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-secondary text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:shadow-lg transition-all"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
