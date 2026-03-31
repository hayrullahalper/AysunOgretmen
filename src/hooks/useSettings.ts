import { useState, useEffect, useCallback } from 'react';
import { firestoreService, UserSettings } from '../lib/firestore';
import { auth } from '../firebase';

const CACHE_KEY_PREFIX = 'aysun_ogretmen_settings_cache_';
const CACHE_TIME_KEY_PREFIX = 'aysun_ogretmen_settings_cache_time_';
const CACHE_EXPIRATION = 1000 * 60 * 60 * 24; // 24 hours for settings

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const getCacheKey = () => `${CACHE_KEY_PREFIX}${auth.currentUser?.uid || 'guest'}`;
  const getCacheTimeKey = () => `${CACHE_TIME_KEY_PREFIX}${auth.currentUser?.uid || 'guest'}`;

  const fetchSettings = useCallback(async (force = false) => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey();
    const cacheTimeKey = getCacheTimeKey();
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    const now = Date.now();

    if (!force && cached && cacheTime && now - parseInt(cacheTime) < CACHE_EXPIRATION) {
      try {
        setSettings(JSON.parse(cached));
        setLoading(false);
        return;
      } catch (e) {
        console.error('Error parsing cached settings:', e);
      }
    }

    setLoading(true);
    try {
      const data = await firestoreService.getSettings();
      if (data) {
        setSettings(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimeKey, Date.now().toString());
      } else {
        const defaultSettings: UserSettings = {
          defaultGrade: '1',
          ownerId: auth.currentUser.uid
        };
        setSettings(defaultSettings);
        localStorage.setItem(cacheKey, JSON.stringify(defaultSettings));
        localStorage.setItem(cacheTimeKey, Date.now().toString());
      }
    } catch (error) {
      console.error('Error fetching settings from Firestore:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (newSettings: UserSettings) => {
    if (!auth.currentUser) return;
    
    await firestoreService.saveSettings(newSettings);
    setSettings(newSettings);
    localStorage.setItem(getCacheKey(), JSON.stringify(newSettings));
    localStorage.setItem(getCacheTimeKey(), Date.now().toString());
  }, []);

  return { settings, loading, updateSettings, refresh: () => fetchSettings(true) };
}
