import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { showInAppNotification } from '../services/notificationService';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { getUserProfile } from '../services/userService';
import { getKostsByOwner } from '../services/kostService';
import Constants, { AppOwnership } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// We'll import Notifications dynamically inside the hooks
// to prevent any side-effects in Expo Go



interface NotificationContextType {
  unreadChatCount: number;
  newOrderCount: number;
  newReportCount: number;
  newBroadcastCount: number;
  pendingKostsCount: number;
  newPaymentCount: number;
  markBroadcastsAsSeen: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadChatCount: 0,
  newOrderCount: 0,
  newReportCount: 0,
  newBroadcastCount: 0,
  pendingKostsCount: 0,
  newPaymentCount: 0,
  markBroadcastsAsSeen: () => {},
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [newReportCount, setNewReportCount] = useState(0);
  const [newBroadcastCount, setNewBroadcastCount] = useState(0);
  const [pendingKostsCount, setPendingKostsCount] = useState(0);
  const [newPaymentCount, setNewPaymentCount] = useState(0);
  const [lastSeenBroadcast, setLastSeenBroadcast] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('lastSeenBroadcast').then(val => {
      if (val) setLastSeenBroadcast(parseInt(val));
    });
  }, []);

  const markBroadcastsAsSeen = () => {
    const now = Date.now();
    setLastSeenBroadcast(now);
    setNewBroadcastCount(0);
    AsyncStorage.setItem('lastSeenBroadcast', now.toString());
  };

  // Configure how notifications are handled when the app is foregrounded
  useEffect(() => {
    if (Constants.appOwnership !== AppOwnership.Expo) {
      const Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  }, []);

  const isFirstChatMount = useRef(true);
  const isFirstOrderMount = useRef(true);
  const isFirstReportMount = useRef(true);
  const prevUid = useRef<string | null>(null);
  // Track current route via refs so the chat listener doesn't restart on nav changes
  const pathnameRef = useRef(pathname);
  const paramsIdRef = useRef(params.id);

  useEffect(() => {
    pathnameRef.current = pathname;
    paramsIdRef.current = params.id;
  }, [pathname, params.id]);

  useEffect(() => {
    const uid = profile?.uid ?? null;
    if (uid !== prevUid.current) {
      isFirstChatMount.current = true;
      isFirstOrderMount.current = true;
      isFirstReportMount.current = true;
      prevUid.current = uid;
      if (!uid) {
        setUnreadChatCount(0);
        setNewOrderCount(0);
        setNewReportCount(0);
        setNewBroadcastCount(0);
        setPendingKostsCount(0);
        setNewPaymentCount(0);
      }
    }
  }, [profile?.uid]);

  // Request notification permissions on mount
  useEffect(() => {
    if (Constants.appOwnership === AppOwnership.Expo) return;

    (async () => {
      try {
        const Notifications = require('expo-notifications');
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
      } catch (e) {
        console.warn('[NotificationContext] Failed to get permissions:', e);
      }
    })();
  }, []);

  // ─── Chat listener ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof profile?.uid !== 'string') return;

    const q = query(
      collection(db, 'messages'),
      where('receiverId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        // Count only messages with explicit 'sent' or 'delivered' status as unread
        // Old messages without 'status' field are treated as already read
        const unread = snapshot.docs.filter(d => {
          const s = d.data().status;
          return s === 'sent' || s === 'delivered';
        });
        setUnreadChatCount(unread.length);

        if (!isFirstChatMount.current) {
          for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
              const msgData = change.doc.data();
              // Trigger notification only for new unread messages
              const isUnread = msgData.status === 'sent' || msgData.status === 'delivered';
              if (isUnread) {
                // 1. Check if we are already inside THIS specific chat
                const currentPath = pathnameRef.current;
                const currentParamId = paramsIdRef.current;
                const isCurrentChat =
                  currentPath.includes('/chat/') &&
                  currentParamId === msgData.senderId;

                // 2. Only show notification if NOT in this chat
                if (!isCurrentChat) {
                  const senderProfile = await getUserProfile(msgData.senderId);
                  const senderName = senderProfile?.name || 'Seseorang';
                  
                  const targetPath =
                    profile.role === 'owner'
                      ? '/(owner)/chat/[id]'
                      : '/(user)/chat/[id]';

                  const navigationData = {
                    pathname: targetPath as any,
                    params: { id: msgData.senderId, name: senderName },
                  };

                  // Show In-App Toast
                  showInAppNotification(`Pesan dari ${senderName} 💬`, msgData.text, () => {
                    router.push(navigationData);
                  });

                  // Show System Notification (Recent Bar)
                  if (Constants.appOwnership !== AppOwnership.Expo) {
                    try {
                      const Notifications = require('expo-notifications');
                      await Notifications.scheduleNotificationAsync({
                        content: {
                          title: `Pesan dari ${senderName}`,
                          body: msgData.text,
                          data: navigationData,
                        },
                        trigger: null,
                      });
                    } catch (e) {
                      console.warn('[NotificationContext] Failed to schedule chat notification:', e);
                    }
                  }
                }
              }
            }
          }
        }
        isFirstChatMount.current = false;
      },
      (err) => console.error('[NotificationContext] Chat error:', err)
    );

    return () => unsubscribe();
  // ⚠️ Do NOT add pathname/params.id here — use refs instead to avoid listener restart
  }, [profile?.uid, profile?.role]);

  // Handle clicking on system notification
  useEffect(() => {
    if (Constants.appOwnership === AppOwnership.Expo) return;

    const Notifications = require('expo-notifications');
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      if (data && data.pathname) {
        router.push(data);
      }
    });
    return () => subscription.remove();
  }, [router]);

  // ─── Orders listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof profile?.uid !== 'string' || typeof profile?.role !== 'string') return;

    const q = 
      profile.role === 'admin'
        ? query(collection(db, 'bookings')) // Admin needs specific rule for this
        : profile.role === 'owner'
          ? query(collection(db, 'bookings'), where('ownerId', '==', profile.uid))
          : query(collection(db, 'bookings'), where('userId', '==', profile.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const relevant =
          profile.role === 'owner'
            ? snapshot.docs.filter(d => d.data().status === 'pending')
            : snapshot.docs.filter(d => d.data().status !== 'pending' && d.data().status !== 'completed');
        setNewOrderCount(relevant.length);

        if (!isFirstOrderMount.current) {
          snapshot.docChanges().forEach(async (change) => {
            const data = change.doc.data();
            if (profile.role === 'owner' && change.type === 'added' && data.status === 'pending') {
              const title = 'Pesanan Baru 🏠';
              const body = 'Seseorang baru saja mengajukan sewa kost!';
              showInAppNotification(title, body, () => {
                router.push('/(owner)/(tabs)/orders' as any);
              });
              if (Constants.appOwnership !== AppOwnership.Expo) {
                try {
                  const Notifications = require('expo-notifications');
                  await Notifications.scheduleNotificationAsync({
                    content: { title, body },
                    trigger: null,
                  });
                } catch (e) {
                  console.warn('[NotificationContext] Failed to schedule order notification:', e);
                }
              }
            } else if (profile.role === 'user' && change.type === 'modified') {
              const title = 'Update Pesanan 📋';
              const body = `Status pesanan "${data.kostName}" berubah menjadi ${data.status}`;
              showInAppNotification(title, body, () => {
                router.push('/(user)/(tabs)/orders' as any);
              });
              if (Constants.appOwnership !== AppOwnership.Expo) {
                try {
                  const Notifications = require('expo-notifications');
                  await Notifications.scheduleNotificationAsync({
                    content: { title, body },
                    trigger: null,
                  });
                } catch (e) {
                  console.warn('[NotificationContext] Failed to schedule order notification:', e);
                }
              }
            }
          });
        }
        isFirstOrderMount.current = false;
      },
      (err) => console.error('[NotificationContext] Orders error:', err)
    );

    return () => unsubscribe();
  }, [profile?.uid, profile?.role]);

  // ─── Reports listener ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof profile?.uid !== 'string') return;

    const q = query(
      collection(db, 'reports'),
      where(profile.role === 'owner' ? 'ownerId' : 'userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const relevant = profile.role === 'owner'
        ? snapshot.docs.filter(d => d.data().status === 'pending')
        : snapshot.docs.filter(d => d.data().status === 'done' && !d.data().seenByUser);
      
      setNewReportCount(relevant.length);

      if (!isFirstReportMount.current) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added' && profile.role === 'owner' && change.doc.data().status === 'pending') {
            showInAppNotification('Laporan Masalah ⚠️', 'Seorang penyewa mengirimkan laporan baru.', () => {
              router.push('/(owner)/reports' as any);
            });
          } else if (change.type === 'modified' && profile.role === 'user' && change.doc.data().status === 'done') {
            showInAppNotification('Laporan Ditanggapi ✅', 'Laporan Anda telah ditanggapi oleh pemilik kost.', () => {
              router.push('/(user)/(tabs)/my-kost' as any);
            });
          }
        });
      }
      isFirstReportMount.current = false;
    }, (err) => console.error('[NotificationContext] Reports error:', err));

    return () => unsubscribe();
  }, [profile?.uid, profile?.role]);

  // ─── Broadcasts listener (User only) ──────────────────────────────────────────
  useEffect(() => {
    if (profile?.role !== 'user') return;

    const q = collection(db, 'broadcasts');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recent = snapshot.docs.filter(d => {
        const data = d.data();
        return data.createdAt > lastSeenBroadcast;
      });
      setNewBroadcastCount(recent.length);
    }, (err) => console.error('[NotificationContext] Broadcasts error:', err));

    return () => unsubscribe();
  }, [profile?.role, lastSeenBroadcast]);

  // ─── Admin Pending Kosts listener ──────────────────────────────────────────
  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const q = query(collection(db, 'kosts'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingKostsCount(snapshot.size);

      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const title = 'Pengajuan Kost Baru 🏠';
          const body = `${data.name} menunggu verifikasi Anda.`;
          
          showInAppNotification(title, body, () => {
            router.push('/(admin)/verification' as any);
          });

          if (Constants.appOwnership !== AppOwnership.Expo) {
            try {
              const Notifications = require('expo-notifications');
              await Notifications.scheduleNotificationAsync({
                content: { title, body },
                trigger: null,
              });
            } catch (e) {
              console.warn('[NotificationContext] Failed to schedule admin notification:', e);
            }
          }
        }
      });
    }, (err) => console.error('[NotificationContext] Admin Pending Kosts error:', err));

    return () => unsubscribe();
  }, [profile?.role]);

  // ─── Payments listener (Owner only) ──────────────────────────────────────────
  useEffect(() => {
    if (profile?.role !== 'owner' || !profile?.uid) return;

    // Filter by ownerId directly to comply with Security Rules
    const q = query(collection(db, 'payments'), where('ownerId', '==', profile.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingPayments = snapshot.docs.filter(d => {
        const data = d.data();
        return data.history?.some((h: any) => h.status === 'pending');
      });
      
      setNewPaymentCount(pendingPayments.length);

      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified' || change.type === 'added') {
          const data = change.doc.data();
          const hasNewPending = data.history?.some((h: any) => h.status === 'pending');
          
          if (hasNewPending) {
            const title = 'Pembayaran Baru 💰';
            const body = 'Seorang penyewa baru saja melaporkan pembayaran.';
            
            showInAppNotification(title, body, () => {
              router.push('/(owner)/payments' as any);
            });

            if (Constants.appOwnership !== AppOwnership.Expo) {
              try {
                const Notifications = require('expo-notifications');
                await Notifications.scheduleNotificationAsync({
                  content: { title, body },
                  trigger: null,
                });
              } catch (e) {
                console.warn('[NotificationContext] Failed to schedule payment notification:', e);
              }
            }
          }
        }
      });
    }, (err) => console.error('[NotificationContext] Payments error:', err));

    return () => unsubscribe();
  }, [profile?.role, profile?.uid]);

  return (
    <NotificationContext.Provider value={{ 
      unreadChatCount, 
      newOrderCount, 
      newReportCount, 
      newBroadcastCount,
      pendingKostsCount,
      newPaymentCount,
      markBroadcastsAsSeen
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
