import { collection, query, orderBy, onSnapshot, getDocs, addDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { Broadcast } from '../types';

export const createBroadcast = async (broadcast: Omit<Broadcast, 'id'>) => {
  return await addDoc(collection(db, 'broadcasts'), {
    ...broadcast,
    createdAt: Date.now()
  });
};

export const listenBroadcasts = (kostId: string | null, callback: (broadcasts: Broadcast[]) => void) => {
  // Use a simpler query that doesn't require composite indexes
  const q = query(collection(db, 'broadcasts'));
  
  return onSnapshot(q, (snapshot) => {
    let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broadcast));
    
    // Filter by kostId on the client if provided
    if (kostId) {
      data = data.filter(b => b.kostId === kostId);
    }
    
    // Sort by createdAt DESC on the client
    data.sort((a, b) => b.createdAt - a.createdAt);
    
    callback(data);
  }, (error) => {
    console.error("[BroadcastService] Listener error:", error);
  });
};
