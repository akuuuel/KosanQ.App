import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';

export const awardPoints = async (userId: string, points: number) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;
  
  const userData = userSnap.data() as UserProfile;
  const newTotalPoints = (userData.points || 0) + points;
  
  // Calculate Member Status
  let newStatus: UserProfile['memberStatus'] = 'Bronze';
  if (newTotalPoints >= 1000) newStatus = 'Platinum';
  else if (newTotalPoints >= 500) newStatus = 'Gold';
  else if (newTotalPoints >= 100) newStatus = 'Silver';

  await updateDoc(userRef, {
    points: increment(points),
    memberStatus: newStatus
  });

  // Logic for vouchers (e.g., get 1 voucher every 500 points)
  if (Math.floor(newTotalPoints / 500) > Math.floor((userData.points || 0) / 500)) {
    await updateDoc(userRef, {
      vouchers: increment(1)
    });
  }
};

export const useVoucher = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    vouchers: increment(-1)
  });
};
