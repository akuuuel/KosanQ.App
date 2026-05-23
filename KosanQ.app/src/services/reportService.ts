import { collection, addDoc, query, where, getDocs, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Report } from '../types';

export const createReport = async (report: Omit<Report, 'id'>) => {
  return await addDoc(collection(db, 'reports'), {
    ...report,
    seenByUser: false
  });
};

export const listenUserReports = (userId: string, kostId: string | null, callback: (reports: Report[]) => void) => {
  // Simplest query to avoid composite index requirements
  const q = query(
    collection(db, 'reports'),
    where('userId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
    
    // Filter by kostId on client side
    if (kostId) {
      data = data.filter(r => r.kostId === kostId);
    }
    
    // Sort on client side
    data.sort((a, b) => b.createdAt - a.createdAt);
    
    callback(data);
  }, (error) => {
    console.error("[ReportService] Listener error:", error);
  });
};

export const listenOwnerReports = (ownerId: string, callback: (reports: Report[]) => void) => {
  const q = query(
    collection(db, 'reports'),
    where('ownerId', '==', ownerId)
  );
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
    callback(data.sort((a, b) => b.createdAt - a.createdAt));
  });
};

export const updateReport = async (reportId: string, data: Partial<Report>) => {
  const reportRef = doc(db, 'reports', reportId);
  await updateDoc(reportRef, data);
};

export const markUserReportsAsSeen = async (userId: string) => {
  const q = query(
    collection(db, 'reports'),
    where('userId', '==', userId),
    where('status', '==', 'done')
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  let hasUpdates = false;
  snapshot.docs.forEach((d) => {
    if (d.data().seenByUser !== true) {
      batch.update(d.ref, { seenByUser: true });
      hasUpdates = true;
    }
  });
  if (hasUpdates) await batch.commit();
};
