import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Tenant, MonthlyStatus } from '../types';

const TENANTS_COLLECTION = 'tenants';
const PAYMENTS_COLLECTION = 'payments';

export const addTenant = async (tenant: Omit<Tenant, 'id'>) => {
  // 0. Validate: Check if user is already an active tenant in this kost
  const existingTenantQ = query(
    collection(db, TENANTS_COLLECTION),
    where('userId', '==', tenant.userId),
    where('kostId', '==', tenant.kostId),
    where('isActive', '==', true)
  );
  const existingSnap = await getDocs(existingTenantQ);
  if (!existingSnap.empty) {
    throw new Error('Pengguna ini sudah terdaftar sebagai penghuni aktif di kost ini.');
  }

  // 0b. Validate: Check if room is still available
  const roomDoc = await import('firebase/firestore').then(m => m.getDoc(doc(db, 'rooms', tenant.roomId)));
  if (roomDoc.exists() && roomDoc.data()?.status === 'occupied') {
    throw new Error('Kamar ini sudah terisi oleh penghuni lain.');
  }

  // 1. Add tenant document
  const tenantRef = await addDoc(collection(db, TENANTS_COLLECTION), {
    ...tenant,
    isActive: true,
    createdAt: Date.now()
  });
  
  // 2. Update room status to 'occupied'
  const roomRef = doc(db, 'rooms', tenant.roomId);
  await updateDoc(roomRef, { 
    status: 'occupied',
    updatedAt: Date.now()
  });

  // 3. Initialize payment record for the current year
  const currentYear = new Date().getFullYear();
  const initialStatus: MonthlyStatus = {
    jan: false, feb: false, mar: false, apr: false, may: false, jun: false,
    jul: false, aug: false, sep: false, oct: false, nov: false, dec: false
  };

  await addDoc(collection(db, PAYMENTS_COLLECTION), {
    tenantId: tenantRef.id,
    userId: tenant.userId,
    kostId: tenant.kostId,
    ownerId: (tenant as any).ownerId,
    year: currentYear,
    monthlyStatus: initialStatus,
    proofImages: [],
    history: [],
    createdAt: Date.now(),
    updatedAt: new Date().toISOString()
  });

  return tenantRef;
};

export const listenTenantsByKost = (kostId: string, callback: (tenants: Tenant[]) => void) => {
  const q = query(collection(db, TENANTS_COLLECTION), where('kostId', '==', kostId), where('isActive', '==', true));
  return onSnapshot(q, (snapshot) => {
    const tenants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
    callback(tenants);
  }, (error) => {
    console.error("[TenantService] Listener error:", error);
  });
};

export const getTenantByUserId = async (userId: string) => {
  const q = query(collection(db, TENANTS_COLLECTION), where('userId', '==', userId), where('isActive', '==', true));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Tenant;
};

export const deactivateTenant = async (tenantId: string, roomId: string) => {
  const tenantRef = doc(db, TENANTS_COLLECTION, tenantId);
  await updateDoc(tenantRef, { 
    isActive: false,
    updatedAt: Date.now()
  });

  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, { 
    status: 'available',
    updatedAt: Date.now()
  });
};

export const checkActiveTenant = async (userId: string, kostId: string) => {
  const q = query(
    collection(db, TENANTS_COLLECTION),
    where('userId', '==', userId),
    where('kostId', '==', kostId),
    where('isActive', '==', true)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};
