import React, { useState, useEffect } from 'react';
import { firestoreService, UserSettings } from '../lib/firestore';
import { Save, Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  const [defaultGrade, setDefaultGrade] = useState('1');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await firestoreService.getSettings();
      if (settings) {
        setDefaultGrade(settings.defaultGrade);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await firestoreService.saveSettings({
        defaultGrade,
        ownerId: '' // Will be set by service
      });
      alert('Ayarlar kaydedildi!');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass p-8 rounded-3xl max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <SettingsIcon className="text-primary" /> Uygulama Ayarları
      </h2>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold opacity-70">Varsayılan Sınıf</label>
          <select 
            value={defaultGrade} 
            onChange={(e) => setDefaultGrade(e.target.value)}
            className="input-field"
          >
            {[1, 2, 3, 4].map(n => <option key={n} value={n.toString()}>{n}. Sınıf</option>)}
          </select>
          <p className="text-xs opacity-50 italic">Yeni materyal oluştururken bu sınıf otomatik seçili gelir.</p>
        </div>

        <button 
          onClick={handleSave} 
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Save size={20} /> {loading ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
        </button>
      </div>
    </div>
  );
}
