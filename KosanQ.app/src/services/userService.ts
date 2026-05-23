import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', uid);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { uid: snapshot.id, ...snapshot.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('[UserService] Error getting profile:', error);
    return null;
  }
};

export const getUserByEmail = async (email: string): Promise<UserProfile | null> => {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email.trim()), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const d = snapshot.docs[0];
      return { uid: d.id, ...d.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('[UserService] Error getting user by email:', error);
    return null;
  }
};
