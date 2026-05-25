import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Booking } from '../types';

export const createBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt'>) => {
  const bookingsRef = collection(db, 'bookings');
  return await addDoc(bookingsRef, {
    ...bookingData,
    createdAt: Date.now()
  });
};

export const getUserBookings = async (userId: string) => {
  if (!userId) return [];
  const q = query(
    collection(db, 'bookings'),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
  // Sort in-memory to avoid composite index requirement
  return results.sort((a, b) => b.createdAt - a.createdAt);
};

export const getOwnerBookings = async (ownerId: string) => {
  if (!ownerId) return [];
  const q = query(
    collection(db, 'bookings'),
    where('ownerId', '==', ownerId)
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
  // Sort in-memory to avoid composite index requirement
  return results.sort((a, b) => b.createdAt - a.createdAt);
};

export const updateBookingStatus = async (bookingId: string, status: Booking['status'], rejectionReason?: string) => {
  if (!bookingId) return;
  const bookingRef = doc(db, 'bookings', bookingId);
  
  const updateData: any = { 
    status,
    updatedAt: Date.now() 
  };
  if (rejectionReason !== undefined) {
    updateData.rejectionReason = rejectionReason;
  }
  
  return await updateDoc(bookingRef, updateData);
};

export const deleteBooking = async (bookingId: string) => {
  if (!bookingId) return;
  const bookingRef = doc(db, 'bookings', bookingId);
  return await deleteDoc(bookingRef);
};

export const checkPendingBooking = async (userId: string, kostId: string) => {
  const q = query(
    collection(db, 'bookings'),
    where('userId', '==', userId),
    where('kostId', '==', kostId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};
