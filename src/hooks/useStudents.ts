import { useState, useEffect, useCallback } from 'react';
import { firestoreService, Student } from '../lib/firestore';
import { auth } from '../firebase';

const CACHE_KEY_PREFIX = 'aysun_ogretmen_students_cache_';
const CACHE_TIME_KEY_PREFIX = 'aysun_ogretmen_students_cache_time_';
const CACHE_EXPIRATION = 1000 * 60 * 60; // 1 hour

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const getCacheKey = () => `${CACHE_KEY_PREFIX}${auth.currentUser?.uid || 'guest'}`;
  const getCacheTimeKey = () => `${CACHE_TIME_KEY_PREFIX}${auth.currentUser?.uid || 'guest'}`;

  const fetchStudents = useCallback(async (force = false) => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey();
    const cacheTimeKey = getCacheTimeKey();
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    const now = Date.now();

    // Use cache if it's valid and not forced
    if (!force && cached && cacheTime && now - parseInt(cacheTime) < CACHE_EXPIRATION) {
      try {
        setStudents(JSON.parse(cached));
        setLoading(false);
        return;
      } catch (e) {
        console.error('Error parsing cached students:', e);
      }
    }

    setLoading(true);
    try {
      const data = await firestoreService.getStudentsOnce();
      setStudents(data);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(cacheTimeKey, Date.now().toString());
    } catch (error) {
      console.error('Error fetching students from Firestore:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const refresh = useCallback(() => {
    return fetchStudents(true);
  }, [fetchStudents]);

  return { students, loading, refresh };
}
