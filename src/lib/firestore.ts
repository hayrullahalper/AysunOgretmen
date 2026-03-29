import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export interface Student {
  id: string;
  name: string;
  surname: string;
  ownerId: string;
}

export interface Material {
  id: string;
  title: string;
  content: any;
  type: 'quiz' | 'story';
  createdAt: string;
  ownerId: string;
}

export interface UserSettings {
  defaultGrade: string;
  ownerId: string;
}

export const firestoreService = {
  // Error handling
  handleError: (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error.message || String(error),
      operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      }
    };
    console.error(`Firestore Error [${operation}]:`, JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  },

  // Students
  getStudents: (callback: (students: Student[]) => void) => {
    if (!auth.currentUser) return () => {};
    const q = query(collection(db, 'students'), where('ownerId', '==', auth.currentUser.uid));
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => doc.data() as Student);
      callback(students);
    }, (error) => {
      firestoreService.handleError(error, 'list', 'students');
    });
  },
  saveStudent: async (student: Student) => {
    if (!auth.currentUser) return;
    const data = { ...student, ownerId: auth.currentUser.uid };
    console.log('Saving student data:', data);
    try {
      await setDoc(doc(db, 'students', student.id), data);
    } catch (error) {
      firestoreService.handleError(error, 'write', `students/${student.id}`);
    }
  },
  deleteStudent: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (error) {
      firestoreService.handleError(error, 'delete', `students/${id}`);
    }
  },

  // Materials
  getMaterials: (callback: (materials: Material[]) => void) => {
    if (!auth.currentUser) return () => {};
    const q = query(collection(db, 'materials'), where('ownerId', '==', auth.currentUser.uid));
    return onSnapshot(q, (snapshot) => {
      const materials = snapshot.docs.map(doc => doc.data() as Material);
      callback(materials);
    }, (error) => {
      firestoreService.handleError(error, 'list', 'materials');
    });
  },
  saveMaterial: async (material: Material) => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'materials', material.id), { ...material, ownerId: auth.currentUser.uid });
    } catch (error) {
      firestoreService.handleError(error, 'write', `materials/${material.id}`);
    }
  },
  deleteMaterial: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'materials', id));
    } catch (error) {
      firestoreService.handleError(error, 'delete', `materials/${id}`);
    }
  },

  // Settings
  getSettings: async (): Promise<UserSettings | null> => {
    if (!auth.currentUser) return null;
    try {
      const docRef = doc(db, 'settings', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as UserSettings : null;
    } catch (error) {
      firestoreService.handleError(error, 'get', `settings/${auth.currentUser?.uid}`);
      return null;
    }
  },
  saveSettings: async (settings: UserSettings) => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'settings', auth.currentUser.uid), { ...settings, ownerId: auth.currentUser.uid });
    } catch (error) {
      firestoreService.handleError(error, 'write', `settings/${auth.currentUser?.uid}`);
    }
  },

  // Users
  getUser: async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as { uid: string; email: string; role: 'admin' | 'user'; grade?: string; firstName?: string; lastName?: string } : null;
    } catch (error) {
      firestoreService.handleError(error, 'get', `users/${uid}`);
      return null;
    }
  },
  saveUser: async (user: { uid: string; email: string; role: 'admin' | 'user'; grade?: string; firstName?: string; lastName?: string }) => {
    try {
      await setDoc(doc(db, 'users', user.uid), user);
    } catch (error) {
      firestoreService.handleError(error, 'write', `users/${user.uid}`);
    }
  }
};
