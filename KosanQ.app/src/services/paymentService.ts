import { collection, updateDoc, doc, query, where, onSnapshot, getDocs, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { Payment, MonthlyStatus, PaymentHistory } from '../types';

const PAYMENTS_COLLECTION = 'payments';

export const listenPaymentsByKost = (kostId: string, callback: (payments: Payment[]) => void) => {
  const q = query(collection(db, PAYMENTS_COLLECTION), where('kostId', '==', kostId));
  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    callback(payments);
  });
};

export const listenPaymentByTenant = (tenantId: string, userId: string, callback: (payment: Payment | null) => void) => {
  const q = query(
    collection(db, PAYMENTS_COLLECTION), 
    where('tenantId', '==', tenantId),
    where('userId', '==', userId)
  );
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
    } else {
      callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Payment);
    }
  }, (error) => {
    console.error("[PaymentService] Listener error:", error);
  });
};

export const updatePaymentStatus = async (paymentId: string, monthlyStatus: MonthlyStatus) => {
  const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
  await updateDoc(paymentRef, { 
    monthlyStatus,
    updatedAt: new Date().toISOString()
  });
};

export const addPaymentHistory = async (paymentId: string, history: Omit<PaymentHistory, 'id'>) => {
  const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
  const newHistory = {
    ...history,
    id: Math.random().toString(36).substr(2, 9),
  };
  await updateDoc(paymentRef, {
    history: arrayUnion(newHistory),
    updatedAt: new Date().toISOString()
  });
};

import { awardPoints } from './loyaltyService';

export const approvePayment = async (paymentId: string, historyId: string, month: string, currentHistory: any[], userId: string) => {
  const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
  
  // Update the specific history item status to 'approved'
  const updatedHistory = currentHistory.map(h => 
    h.id === historyId ? { ...h, status: 'approved' as const } : h
  );

  await updateDoc(paymentRef, {
    history: updatedHistory,
    [`monthlyStatus.${month}`]: true,
    updatedAt: new Date().toISOString()
  });

  // Award 50 points for every successful payment
  await awardPoints(userId, 50);
};

export const uploadPaymentProof = async (paymentId: string, imageUrl: string) => {
  const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
  await updateDoc(paymentRef, {
    proofImages: arrayUnion(imageUrl),
    updatedAt: new Date().toISOString()
  });
};
