import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  onSnapshot,
  Firestore,
  limit,
  updateDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Review, Kost } from '../types';

/**
 * Kirim ulasan baru untuk sebuah kost
 */
export const createReview = async (reviewData: any) => {
  try {
    const docRef = await addDoc(collection(db, 'reviews'), {
      kostId: reviewData.kostId,
      userId: reviewData.userId,
      userName: reviewData.userName,
      userPhoto: reviewData.userPhoto || '',
      rating: Number(reviewData.rating),
      comment: reviewData.comment,
      createdAt: Date.now()
    });
    // Update Kost average rating (Denormalization)
    const kostRef = doc(db, 'kosts', reviewData.kostId);
    const kostSnap = await getDoc(kostRef);
    
    if (kostSnap.exists()) {
      const kostData = kostSnap.data() as Kost;
      const currentTotal = kostData.totalReviews || 0;
      const currentAvg = kostData.averageRating || 0;
      
      const newTotal = currentTotal + 1;
      const newAvg = ((currentAvg * currentTotal) + Number(reviewData.rating)) / newTotal;
      
      await updateDoc(kostRef, {
        totalReviews: newTotal,
        averageRating: newAvg
      });
    }

    return docRef.id;
  } catch (error) {
    console.error('[ReviewService] Error creating review:', error);
    throw error;
  }
};

/**
 * Ambil semua ulasan untuk kost tertentu
 */
export const getReviewsByKostId = async (kostId: string): Promise<Review[]> => {
  try {
    const q = query(
      collection(db, 'reviews'),
      where('kostId', '==', kostId)
    );
    const querySnapshot = await getDocs(q);
    const reviews = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Review[];
    
    // Sort locally by createdAt desc
    return reviews.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('[ReviewService] Error getting reviews:', error);
    return [];
  }
};

/**
 * Real-time listener untuk ulasan kost tertentu
 */
export const listenKostReviews = (kostId: string, callback: (reviews: Review[]) => void) => {
  const q = query(
    collection(db, 'reviews'),
    where('kostId', '==', kostId)
  );

  return onSnapshot(q, (snapshot) => {
    const reviews = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Review[];
    
    // Sort locally
    callback(reviews.sort((a, b) => b.createdAt - a.createdAt));
  }, (error) => {
    console.error("[ReviewService] Listener error:", error);
  });
};

/**
 * Cek apakah user sudah pernah memberi ulasan di kost ini
 */
export const hasUserReviewed = async (kostId: string, userId: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, 'reviews'),
      where('kostId', '==', kostId),
      where('userId', '==', userId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    return false;
  }
};
