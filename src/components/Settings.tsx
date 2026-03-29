import React, { useState, useEffect } from 'react';
import { firestoreService, UserSettings } from '../lib/firestore';
import { Save, Settings as SettingsIcon, User } from 'lucide-react';
import { auth } from '../firebase';
import { useSettings } from '../hooks/useSettings';

export default function Settings() {
  const { settings, updateSettings, loading: settingsLoading } = useSettings();
  const [defaultGrade, setDefaultGrade] = useState('1');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setDefaultGrade(settings.defaultGrade);
    }
    
    const loadUser = async () => {
      if (!auth.currentUser) return;
      const user = await firestoreService.getUser(auth.currentUser.uid);
      if (user) {
        setFirstName(user.firstName || '');
        setLastName(user.lastName || '');
      }
    };
    loadUser();
  }, [settings]);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      // Save settings using hook
      await updateSettings({
        defaultGrade,
        ownerId: auth.currentUser.uid
      });

      // Save user profile
      await firestoreService.saveUser({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        role: 'user',
        firstName,
        lastName
      });

      alert('Ayarlar ve profil kaydedildi!');
    } catch (error) {
      console.error(error);
      alert('Kaydedilirken bir hata oluştu.');
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-70">Adınız</label>
            <input 
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input-field"
              placeholder="Adınız"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-70">Soyadınız</label>
            <input 
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input-field"
              placeholder="Soyadınız"
            />
          </div>
        </div>

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
