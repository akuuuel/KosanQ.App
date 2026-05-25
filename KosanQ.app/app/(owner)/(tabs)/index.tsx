import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image,
  StatusBar,
  Modal,
  Alert
} from 'react-native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../../../src/services/firebase';
import { getKostsByOwner } from '../../../src/services/kostService';
import { listenRooms } from '../../../src/services/roomService';
import { listenTenantsByKost } from '../../../src/services/tenantService';
import { useAuth } from '../../../src/context/AuthContext';
import { Kost, Room, Tenant } from '../../../src/types';
import { signOut } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useNotifications } from '../../../src/context/NotificationContext';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { deleteKost } from '../../../src/services/kostService';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';

export default function OwnerDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  
  const isProfileComplete = 
    profile?.name && 
    profile?.email && 
    profile?.whatsapp && 
    profile?.photoURL && 
    profile?.ktpURL &&
    profile?.selfieKTPURL &&
    profile?.npwp &&
    profile?.address &&
    profile?.bankName &&
    profile?.bankAccount;

  const [kosts, setKosts] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [stats, setStats] = useState({
    totalRooms: 0,
    availableRooms: 0,
    totalTenants: 0
  });
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });
  const [kostDataMap, setKostDataMap] = useState<{[key: string]: {rooms: Room[], tenants: Tenant[]}}>({});
  const [selectedKostDetail, setSelectedKostDetail] = useState<Kost | null>(null);
  const [isFromHistory, setIsFromHistory] = useState(false);

  const fetchDashboardData = async () => {
    if (!profile?.uid) return;

    try {
      setLoading(true);
      // Cleanup existing listeners
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];

      const kostRooms: { [key: string]: Room[] } = {};
      const kostTenants: { [key: string]: Tenant[] } = {};

      const updateStats = (currentKosts: Kost[]) => {
        let roomsCount = 0;
        let availCount = 0;
        let tenantsCount = 0;

        currentKosts.forEach(kost => {
          const rooms = kostRooms[kost.id] || [];
          if (kost.status === 'approved') {
            roomsCount += rooms.length;
            availCount += rooms.filter(r => r.status?.toLowerCase() === 'available').length;
          }
          const tenants = kostTenants[kost.id] || [];
          if (kost.status === 'approved') {
            tenantsCount += tenants.length;
          }
        });

        setStats({
          totalRooms: roomsCount,
          availableRooms: availCount,
          totalTenants: tenantsCount
        });
        
        const newMap: {[key: string]: {rooms: Room[], tenants: Tenant[]}} = {};
        currentKosts.forEach(k => {
          newMap[k.id] = {
            rooms: kostRooms[k.id] || [],
            tenants: kostTenants[k.id] || []
          };
        });
        setKostDataMap(newMap);
      };

      // REAL-TIME KOST LISTENER
      const q = query(
        collection(db, 'kosts'), 
        where('ownerId', '==', profile.uid)
      );

      const unsubKosts = onSnapshot(q, (snapshot) => {
        const myKosts = snapshot.docs.map(doc => {
          const data = doc.data();
          // Normalize createdAt from Firebase Timestamp to millis
          const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || 0);
          return { id: doc.id, ...data, createdAt } as Kost;
        });
        
        console.log('[Dashboard] Real-time kosts update:', myKosts.length);
        setKosts(myKosts);
        
        // Setup individual listeners for rooms and tenants for each kost
        myKosts.forEach(kost => {
          const unsubRooms = listenRooms(kost.id, (rooms) => {
            kostRooms[kost.id] = rooms;
            updateStats(myKosts);
          });
          unsubsRef.current.push(unsubRooms);

          const unsubTenants = listenTenantsByKost(kost.id, (tenants) => {
            kostTenants[kost.id] = tenants;
            updateStats(myKosts);
          });
          unsubsRef.current.push(unsubTenants);
        });

        updateStats(myKosts);
        setLoading(false);
      }, (error) => {
        console.error('[Dashboard] Kost listener error:', error);
        setLoading(false);
      });

      unsubsRef.current.push(unsubKosts);
      
    } catch (error) {
      console.error('[Dashboard] Setup error:', error);
      setLoading(false);
    }
  };

  const unsubsRef = React.useRef<Array<() => void>>([]);

  useFocusEffect(
    React.useCallback(() => {
      fetchDashboardData();
      return () => {
        // Cleanup on unfocus or unmount
        unsubsRef.current.forEach(u => u());
        unsubsRef.current = [];
      };
    }, [profile?.uid])
  );

  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const handleDeleteKost = async () => {
    if (!deleteTarget) return;
    try {
      setLoading(true);
      
      // Alih-alih menghapus keseluruhan data Kost (yang bisa menyebabkan data hilang),
      // kita hanya menyembunyikannya dari tampilan "Riwayat Pengajuan"
      const { doc, updateDoc, deleteDoc } = await import('firebase/firestore');
      const kostRef = doc(db, 'kosts', deleteTarget.id);
      
      // Jika statusnya masih 'rejected' atau 'pending' (belum aktif), kita bisa hapus permanen.
      // Jika sudah 'approved', kita hanya sembunyikan dari riwayat agar data properti tetap aman.
      const targetKost = kosts.find(k => k.id === deleteTarget.id);
      
      if (targetKost?.status === 'approved') {
        await updateDoc(kostRef, { showInHistory: false });
        showAlert('Berhasil', 'Riwayat pendaftaran telah disembunyikan.', 'success');
      } else {
        await deleteDoc(kostRef);
        showAlert('Sukses', 'Pengajuan berhasil dihapus.', 'success');
      }
      
      setDeleteTarget(null);
    } catch (e: any) {
      console.error('[Delete Kost Error]:', e);
      showAlert('Error', e.message || 'Gagal menghapus riwayat.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const { newReportCount, newPaymentCount } = useNotifications();

  const ActionCard = ({ title, icon, color, onPress, badge }: any) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
        <FontAwesome5 name={icon} size={20} color={color} />
        {badge > 0 && (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              {profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.avatarImg} />
              ) : (
                <FontAwesome5 name="user-tie" size={20} color="#fff" />
              )}
            </View>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.greeting}>Halo, {profile?.name || 'Juragan'}!</Text>
              <Text style={styles.roleText}>{profile?.bio || 'Pemilik Kost'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setLogoutVisible(true)} style={styles.logoutBtn}>
            <FontAwesome5 name="power-off" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          {loading ? (
            <>
              <View style={styles.statItem}><SkeletonLoader width={60} height={25} /></View>
              <View style={[styles.statItem, styles.statBorder]}><SkeletonLoader width={60} height={25} /></View>
              <View style={styles.statItem}><SkeletonLoader width={60} height={25} /></View>
            </>
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalRooms}</Text>
                <Text style={styles.statLabel}>Total Kamar</Text>
              </View>
              <View style={[styles.statItem, styles.statBorder]}>
                <Text style={styles.statValue}>{stats.availableRooms}</Text>
                <Text style={styles.statLabel}>Kamar Kosong</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalTenants}</Text>
                <Text style={styles.statLabel}>Penghuni</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.content}>
        {loading ? (
          <>
            <SkeletonLoader height={180} borderRadius={24} style={{ marginBottom: 24 }} />
            <SkeletonLoader width={150} height={20} style={{ marginBottom: 20 }} />
            <View style={styles.actionGrid}>
              <View style={styles.actionCard}><SkeletonLoader width="100%" height="100%" borderRadius={24} /></View>
              <View style={styles.actionCard}><SkeletonLoader width="100%" height="100%" borderRadius={24} /></View>
              <View style={styles.actionCard}><SkeletonLoader width="100%" height="100%" borderRadius={24} /></View>
              <View style={styles.actionCard}><SkeletonLoader width="100%" height="100%" borderRadius={24} /></View>
            </View>
          </>
        ) : (
          <>
            {kosts.filter(k => k.status === 'approved').length > 0 && (
              <View style={styles.carouselContainer}>
                <ScrollView 
                  horizontal 
                  pagingEnabled 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                >
                  {kosts.filter(k => k.status === 'approved').map(kost => (
                      <TouchableOpacity 
                        key={kost.id} 
                        style={styles.myKostCard}
                        onPress={() => {
                          setSelectedKostDetail(kost);
                          setIsFromHistory(false);
                        }}
                        activeOpacity={0.9}
                      >
                      <View style={styles.myKostHeader}>
                        <FontAwesome5 name="home" size={16} color="#00AA13" />
                        <Text style={styles.myKostTitle}>Tap untuk Detail</Text>
                      </View>
                      <Text style={styles.myKostName} numberOfLines={1}>{kost.name}</Text>
                      <View style={styles.locationRow}>
                        <FontAwesome5 name="map-marker-alt" size={12} color="#64748b" />
                        <Text style={styles.myKostLocation} numberOfLines={1}>{kost.location}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {kosts.filter(k => k.status === 'approved').length > 1 && (
                  <Text style={styles.scrollHint}>Geser untuk melihat kost lain 👉</Text>
                )}
              </View>
            )}

            <Text style={styles.sectionTitle}>Manajemen Kost</Text>
            <View style={styles.actionGrid}>
              {!isProfileComplete && (
                <TouchableOpacity 
                  style={styles.warningBanner} 
                  onPress={() => router.push('/(owner)/edit-profile')}
                >
                  <Text style={styles.warningText}>Lengkapi profil Anda untuk mulai mengelola kost.</Text>
                </TouchableOpacity>
              )}
              <ActionCard 
                title="Kelola Kamar" 
                icon="door-open" 
                color="#3b82f6" 
                onPress={() => router.push('/(owner)/rooms')} 
              />
              <ActionCard 
                title="Kelola Penghuni" 
                icon="users" 
                color="#10b981" 
                onPress={() => router.push('/(owner)/tenants')} 
              />
              <ActionCard 
                title="Status Pembayaran" 
                icon="money-check-alt" 
                color="#f59e0b" 
                badge={newPaymentCount}
                onPress={() => router.push('/(owner)/payments')} 
              />
              <ActionCard 
                title="Laporan Masalah" 
                icon="exclamation-triangle" 
                color="#ef4444" 
                badge={newReportCount}
                onPress={() => router.push('/(owner)/reports')} 
              />
              <ActionCard 
                title="Buat Pengumuman" 
                icon="bullhorn" 
                color="#3b82f6" 
                onPress={() => router.push('/(owner)/broadcast')} 
              />
              <ActionCard 
                title="Tambah Kost Baru" 
                icon="plus-circle" 
                color="#ec4899" 
                onPress={() => router.push('/(owner)/add-kost')} 
              />
            </View>

            <View style={styles.infoBox}>
              <View style={styles.infoIcon}>
                <FontAwesome5 name="lightbulb" size={20} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Tips Juragan</Text>
                <Text style={styles.infoDesc}>Update status pembayaran setiap bulan untuk memantau pemasukan kost Anda.</Text>
              </View>
            </View>

            <View style={styles.pendingSection}>
              <Text style={styles.sectionTitle}>Riwayat Pengajuan</Text>
              {kosts.length > 0 ? (
                kosts
                  .filter(k => k.showInHistory !== false)
                  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                  .map(kost => (
                    <TouchableOpacity 
                      key={kost.id} 
                      style={styles.statusCard}
                      onPress={() => {
                        setSelectedKostDetail(kost);
                        setIsFromHistory(true);
                      }}
                      onLongPress={() => setDeleteTarget({ id: kost.id, name: kost.name })}
                      delayLongPress={500}
                      activeOpacity={0.7}
                    >
                      <View style={styles.statusInfo}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.statusName}>{kost.name}</Text>
                          <View style={[styles.badge, styles[`badge_${kost.status}`]]}>
                            <Text style={styles.badgeText}>
                              {kost.status === 'pending' ? 'MENUNGGU VERIFIKASI' : 
                              kost.status === 'approved' ? 'DISETUJUI' : 'DITOLAK'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {kost.status === 'rejected' && (
                        <View style={styles.rejectionBox}>
                          <Text style={styles.rejectionLabel}>Alasan Penolakan:</Text>
                          <Text style={styles.rejectionText}>{kost.rejectionReason || 'Tidak ada alasan spesifik.'}</Text>
                        </View>
                      )}
                      
                      <View style={styles.historyMeta}>
                        <Text style={styles.tapDetailHint}>Tap untuk detail • Tahan untuk hapus</Text>
                        <Text style={styles.historyDate}>
                          {kost.createdAt ? new Date(kost.createdAt).toLocaleDateString('id-ID') : '-'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyHistoryCard}>
                    <FontAwesome5 name="clipboard-list" size={24} color="#CBD5E1" />
                    <Text style={styles.emptyHistoryText}>Belum ada riwayat pendaftaran kost.</Text>
                  </View>
                )}
            </View>
          </>
        )}
      </View>

        {/* Kost Detail Modal */}
        <Modal visible={!!selectedKostDetail} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detail Properti</Text>
                <TouchableOpacity onPress={() => setSelectedKostDetail(null)}>
                  <FontAwesome5 name="times" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              
              {selectedKostDetail && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Image source={{ uri: selectedKostDetail.images[0] }} style={styles.modalImage} />
                  <Text style={styles.modalKostName}>{selectedKostDetail.name}</Text>
                  
                  <View style={styles.modalStatsRow}>
                    <View style={styles.modalStatBox}>
                      <Text style={styles.modalStatVal}>{kostDataMap[selectedKostDetail.id]?.rooms.length || 0}</Text>
                      <Text style={styles.modalStatLab}>Total Kamar</Text>
                    </View>
                    <View style={styles.modalStatBox}>
                      <Text style={styles.modalStatVal}>{kostDataMap[selectedKostDetail.id]?.tenants.length || 0}</Text>
                      <Text style={styles.modalStatLab}>Penghuni Aktif</Text>
                    </View>
                  </View>

                  <Text style={styles.modalSectionLabel}>Deskripsi Properti</Text>
                  <Text style={styles.modalDesc}>{selectedKostDetail.description || 'Tidak ada deskripsi.'}</Text>
                  
                  {!isFromHistory && selectedKostDetail.status === 'approved' && (
                    <TouchableOpacity 
                      style={[styles.closeBtn, { backgroundColor: '#3b82f6', marginBottom: 12, flexDirection: 'row', justifyContent: 'center' }]} 
                      onPress={() => {
                        setSelectedKostDetail(null);
                        router.push({ pathname: '/(owner)/add-kost', params: { id: selectedKostDetail.id } });
                      }}
                    >
                      <FontAwesome5 name="edit" size={14} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.closeBtnText}>Edit Properti</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={styles.closeBtn} 
                    onPress={() => setSelectedKostDetail(null)}
                  >
                    <Text style={styles.closeBtnText}>Tutup</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
        <CustomAlert 
          visible={logoutVisible}
          title="Konfirmasi Keluar"
          message="Apakah Anda yakin ingin keluar dari akun Anda?"
          type="logout"
          confirmText="Keluar"
          cancelText="Batal"
          onClose={() => setLogoutVisible(false)}
          onConfirm={() => {
            setLogoutVisible(false);
            signOut(auth);
          }}
        />

        <CustomAlert 
          visible={alertVisible}
          title={alertData.title}
          message={alertData.message}
          type={alertData.type}
          onClose={() => setAlertVisible(false)}
          onConfirm={alertData.onConfirm}
        />

        <CustomAlert 
          visible={!!deleteTarget}
          title="Hapus dari Riwayat?"
          message={`Hapus pendaftaran "${deleteTarget?.name}" dari daftar riwayat pengajuan?`}
          type="delete"
          confirmText="Hapus"
          cancelText="Batal"
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteKost}
        />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#00AA13',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 4,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  profileSection: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 15 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  roleText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', flexShrink: 1 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statsContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#F1F5F9' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1C' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },
  content: { padding: 24 },
  myKostCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 24, 
    width: 320,
    marginRight: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#00AA13'
  },
  carouselContainer: { marginBottom: 24 },
  carouselContent: { paddingRight: 20 },
  scrollHint: { fontSize: 11, color: '#94a3b8', marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  myKostHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  myKostTitle: { fontSize: 11, color: '#00AA13', fontWeight: 'bold', textTransform: 'uppercase' },
  myKostName: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  myKostLocation: { fontSize: 12, color: '#64748b' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 32, padding: 24, width: '100%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },
  modalImage: { width: '100%', height: 180, borderRadius: 20, marginBottom: 16 },
  modalKostName: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 16 },
  modalStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  modalStatBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, alignItems: 'center' },
  modalStatVal: { fontSize: 20, fontWeight: 'bold', color: '#00AA13' },
  modalStatLab: { fontSize: 12, color: '#64748b', marginTop: 4 },
  modalSectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#4A4A4A', lineHeight: 22, marginBottom: 24 },
  closeBtn: { backgroundColor: '#00AA13', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 16 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  actionCard: { 
    backgroundColor: '#fff', 
    width: '48%', 
    padding: 16, 
    borderRadius: 24, 
    alignItems: 'center', 
    justifyContent: 'center',
    elevation: 3, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8,
    aspectRatio: 1,
  },
  iconCircle: { 
    width: 54, 
    height: 54, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  actionTitle: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    color: '#1C1C1C', 
    textAlign: 'center' 
  },
  cardBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#EF4444', minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  cardBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  infoBox: { flexDirection: 'row', backgroundColor: '#FFFBEB', padding: 16, borderRadius: 24, marginTop: 24, borderWidth: 1, borderColor: '#FEF3C7', alignItems: 'center', gap: 16 },
  infoIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#92400E' },
  infoDesc: { fontSize: 13, color: '#B45309', marginTop: 2, lineHeight: 18 },
  
  // Pending Section
  pendingSection: { marginTop: 32 },
  statusCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  statusInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusName: { fontSize: 15, fontWeight: 'bold', color: '#1C1C1C' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badge_pending: { backgroundColor: '#FEF3C7' },
  badge_rejected: { backgroundColor: '#FEE2E2' },
  badge_approved: { backgroundColor: '#DCFCE7' },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#92400E' },
  rejectionBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  rejectionLabel: { fontSize: 11, fontWeight: 'bold', color: '#EF4444' },
  rejectionText: { fontSize: 13, color: '#4A4A4A', marginTop: 4, lineHeight: 18 },
  deletePengajuanBtn: { padding: 10, backgroundColor: '#FEF2F2', borderRadius: 10 },
  tapDetailHint: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 10 },
  historyMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  historyDate: { fontSize: 11, color: '#94a3b8' },
  emptyHistoryCard: { backgroundColor: '#fff', borderRadius: 20, padding: 30, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0', gap: 12 },
  emptyHistoryText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  warningBanner: {
    width: '100%',
    backgroundColor: '#FFF7ED',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#9A3412',
    fontWeight: '600',
    flex: 1,
  },
});
