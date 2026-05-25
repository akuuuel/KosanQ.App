import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  query, 
  where, 
  getDocs,
  orderBy,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { Kost } from '../types';

const KOSTS_COLLECTION = 'kosts';

export const createKost = async (kostData: Omit<Kost, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, KOSTS_COLLECTION), {
      ...kostData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating kost:', error);
    throw error;
  }
};

export const getApprovedKosts = async (limitCount: number = 20) => {
  try {
    const q = query(
      collection(db, KOSTS_COLLECTION), 
      where('status', '==', 'approved'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => {
      const d = doc.data();
      return { 
        id: doc.id, 
        ...d,
        createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt || 0)
      } as Kost;
    });
    
    // Sort by createdAt desc
    return data.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error fetching kosts:', error);
    throw error;
  }
};

export const getKostById = async (id: string) => {
  try {
    const docRef = doc(db, KOSTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const d = docSnap.data();
      return { 
        id: docSnap.id, 
        ...d,
        createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt || 0)
      } as Kost;
    }
    return null;
  } catch (error) {
    console.error('Error fetching kost by id:', error);
    throw error;
  }
};

export const getOwnerKosts = async (ownerId: string) => {
  try {
    const q = query(
      collection(db, KOSTS_COLLECTION), 
      where('ownerId', '==', ownerId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kost));
  } catch (error) {
    console.error('Error fetching owner kosts:', error);
    throw error;
  }
};

export const getApprovedOwnerKosts = async (ownerId: string) => {
  try {
    const q = query(
      collection(db, KOSTS_COLLECTION), 
      where('ownerId', '==', ownerId),
      where('status', '==', 'approved')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kost));
  } catch (error) {
    console.error('Error fetching approved owner kosts:', error);
    throw error;
  }
};

// Alias to maintain compatibility with new management screens
export const getKostsByOwner = getOwnerKosts;

export const updateKost = async (id: string, updates: Partial<Kost>) => {
  try {
    const docRef = doc(db, KOSTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating kost:', error);
    throw error;
  }
};

export const deleteKost = async (id: string) => {
  try {
    const docRef = doc(db, KOSTS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting kost:', error);
    throw error;
  }
};
