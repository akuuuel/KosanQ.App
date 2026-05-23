import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  onSnapshot, 
  setDoc,
  doc,
  deleteDoc,
  writeBatch,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Message, Conversation, UserProfile } from '../types';
import { getUserProfile } from './userService';

export const sendMessage = async (senderId: string, receiverId: string, text: string) => {
  const convId = [senderId, receiverId].sort().join('_');
  
  // 1. Add message to messages collection
  const messagesRef = collection(db, 'messages');
  await addDoc(messagesRef, {
    conversationId: convId,
    senderId,
    receiverId,
    text,
    status: 'sent',
    createdAt: serverTimestamp(),
    createdAtLocal: Date.now()
  });

  // 2. Update conversation for both users
  const convRef = doc(db, 'conversations', convId);
  const convSnap = await getDoc(convRef);
  
  let updateData: any = {
    participants: [senderId, receiverId],
    lastMessage: text,
    lastMessageAt: serverTimestamp()
  };

  // If conversation doesn't exist or profiles are missing, fetch and denormalize them
  if (!convSnap.exists() || !convSnap.data().profiles) {
    const [p1, p2] = await Promise.all([
      getUserProfile(senderId),
      getUserProfile(receiverId)
    ]);
    
    if (p1 && p2) {
      updateData.profiles = {
        [senderId]: { 
          name: p1.name || 'User', 
          photoURL: p1.photoURL || '', 
          role: p1.role || 'user',
          bio: p1.bio || ''
        },
        [receiverId]: { 
          name: p2.name || 'User', 
          photoURL: p2.photoURL || '', 
          role: p2.role || 'user',
          bio: p2.bio || ''
        }
      };
    }
  }

  await setDoc(convRef, updateData, { merge: true });
};

export const markMessagesAsRead = async (senderId: string, receiverId: string) => {
  if (!senderId || !receiverId) return;
  const convId = [senderId, receiverId].sort().join('_');
  // Query only by 2 fields to avoid composite index requirement
  // Filter status in JS instead
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', convId),
    where('receiverId', '==', senderId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  let hasUpdates = false;
  snapshot.docs.forEach((d) => {
    const data = d.data();
    // Filter status in JS - only update messages that aren't read yet
    if (data.status !== 'read') {
      batch.update(d.ref, { status: 'read' });
      hasUpdates = true;
    }
  });
  if (hasUpdates) await batch.commit();
};

export const markMessagesAsDelivered = async (userId: string) => {
  // Query only by receiverId to avoid composite index requirement
  const q = query(
    collection(db, 'messages'),
    where('receiverId', '==', userId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  let hasUpdates = false;
  snapshot.docs.forEach((d) => {
    const data = d.data();
    // Only update messages that are still in 'sent' status
    if (data.status === 'sent') {
      batch.update(d.ref, { status: 'delivered' });
      hasUpdates = true;
    }
  });
  if (hasUpdates) await batch.commit();
};

export const setTypingStatus = async (senderId: string, receiverId: string, isTyping: boolean) => {
  const convId = [senderId, receiverId].sort().join('_');
  const convRef = doc(db, 'conversations', convId);
  await setDoc(convRef, {
    typing: {
      [senderId]: isTyping
    }
  }, { merge: true });
};

export const getConversations = (userId: string, callback: (convs: Conversation[]) => void) => {
  const convQ = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );

  // Listen to unread messages in real-time
  const unreadQ = query(
    collection(db, 'messages'),
    where('receiverId', '==', userId)
  );

  let latestConvSnapshot: any = null;
  let latestUnreadMap: Record<string, number> = {};

  const buildAndEmit = () => {
    if (!latestConvSnapshot) return;
    const convs = latestConvSnapshot.docs
      .map((d: any) => {
        const data = d.data();
        const otherUserId = data.participants.find((p: string) => p !== userId);
        const otherProfile = data.profiles ? data.profiles[otherUserId] : null;
        const userDeletedAt = data.deletedAt?.[userId] || 0;

        let lastMsgAt: number;
        if (data.lastMessageAt && typeof data.lastMessageAt.toMillis === 'function') {
          lastMsgAt = data.lastMessageAt.toMillis();
        } else {
          lastMsgAt = data.lastMessageAt || 0;
        }

        if (lastMsgAt < userDeletedAt) return null;

        return {
          id: d.id,
          ...data,
          lastMessageAt: lastMsgAt,
          otherUserId,
          otherUserName: otherProfile?.name || 'User',
          otherUserPhoto: otherProfile?.photoURL || '',
          otherUserRole: otherProfile?.role || 'user',
          unreadCount: latestUnreadMap[d.id] || 0
        } as Conversation;
      })
      .filter((c: any) => c !== null) as Conversation[];
    callback(convs);
  };

  const unsubConv = onSnapshot(convQ, (snapshot) => {
    latestConvSnapshot = snapshot;
    buildAndEmit();
  }, (err) => console.error('[ChatService] getConversations error:', err));

  const unsubUnread = onSnapshot(unreadQ, (snapshot) => {
    const unreadMap: Record<string, number> = {};
    snapshot.docs.forEach(d => {
      const data = d.data();
      // Only count as unread if status is EXPLICITLY 'sent' or 'delivered'
      // Old messages without 'status' field are treated as already read
      const isExplicitlyUnread = data.status === 'sent' || data.status === 'delivered';
      if (isExplicitlyUnread) {
        const cId = data.conversationId;
        unreadMap[cId] = (unreadMap[cId] || 0) + 1;
      }
    });
    latestUnreadMap = unreadMap;
    buildAndEmit();
  });

  // Return combined unsubscribe
  return () => {
    unsubConv();
    unsubUnread();
  };
};

export const listenMessages = (senderId: string, receiverId: string, callback: (msgs: Message[]) => void) => {
  const convId = [senderId, receiverId].sort().join('_');
  
  // First, get the conversation metadata to check for deletedAt
  const convRef = doc(db, 'conversations', convId);
  
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', convId)
  );

  return onSnapshot(q, async (snapshot) => {
    // Get deletedAt from conversation doc
    const convSnap = await getDoc(convRef);
    const deletedAt = convSnap.exists() ? (convSnap.data()?.deletedAt?.[senderId] || 0) : 0;

    const msgs = snapshot.docs
      .map(d => {
        const data = d.data();
        // Handle serverTimestamp: use toMillis() if available, fallback to createdAtLocal or Date.now()
        let timestamp: number;
        if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
          timestamp = data.createdAt.toMillis();
        } else if (typeof data.createdAt === 'number') {
          timestamp = data.createdAt;
        } else {
          timestamp = data.createdAtLocal || Date.now();
        }
        return { 
          id: d.id, 
          senderId: data.senderId, 
          receiverId: data.receiverId, 
          text: data.text, 
          status: data.status || 'sent',
          createdAt: timestamp 
        } as Message;
      })
      .filter(m => m.createdAt > deletedAt);

    // Sort by server timestamp (Ascending) then reverse for inverted FlatList
    msgs.sort((a, b) => a.createdAt - b.createdAt);
    callback(msgs.reverse());
  }, (err) => console.error('[ChatService] listenMessages error:', err));
};

export const deleteConversationForUser = async (convId: string, userId: string) => {
  const convRef = doc(db, 'conversations', convId);
  return await setDoc(convRef, {
    deletedAt: {
      [userId]: Date.now()
    }
  }, { merge: true });
};

// Removed global deleteConversation in favor of per-user deletion
/* 
export const deleteConversation = async (convId: string) => {
  const convRef = doc(db, 'conversations', convId);
  return await deleteDoc(convRef);
};
*/
