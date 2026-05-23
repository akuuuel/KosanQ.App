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
  Modal
} from 'react-native';
import { getKostsByOwner } from '../../../src/services/kostService';
import { listenRooms } from '../../../src/services/roomService';
import { listenTenantsByKost } from '../../../src/services/tenantService';
import { useAuth } from '../../../src/context/AuthContext';
import { Kost, Room, Tenant } from '../../../src/types';
import { auth } from '../../../src/services/firebase';
import { signOut } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotifications } from '../../../src/context/NotificationContext';

export default function OwnerDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRooms: 0,
    availableRooms: 0,
    totalTenants: 0
  });
  const [kostDataMap, setKostDataMap] = useState<{[key: string]: {rooms: Room[], tenants: Tenant[]}}>({});
  const [selectedKostDetail, setSelectedKostDetail] = useState<Kost | null>(null);

  useEffect(() => {
    if (profile?.uid) {
      setLoading(true);
      let unsubRooms: (() => void)[] = [];
      let unsubTenants: (() => void)[] = [];

      getKostsByOwner(profile.uid).then(myKosts => {
        setKosts(myKosts);
        
        // Maps to store room/tenant data per kost
        const kostRooms: { [key: string]: Room[] } = {};
        const kostTenants: { [key: string]: Tenant[] } = {};

        const updateStats = () => {
          let roomsCount = 0;
          let availCount = 0;
          let tenantsCount = 0;

          // Only count stats for APPROVED kosts
          myKosts.filter(k => k.status === 'approved').forEach(kost => {
            const rooms = kostRooms[kost.id] || [];
            roomsCount += rooms.length;
            availCount += rooms.filter(r => r.status === 'available').length;

            const tenants = kostTenants[kost.id] || [];
            tenantsCount += tenants.length;
          });

          setStats({
            totalRooms: roomsCount,
            availableRooms: availCount,
            totalTenants: tenantsCount
          });
          
          // Update data map for per-kost details
          const newMap: {[key: string]: {rooms: Room[], tenants: Tenant[]}} = {};
          myKosts.forEach(k => {
            newMap[k.id] = {
              rooms: kostRooms[k.id] || [],
              tenants: kostTenants[k.id] || []
            };
          });
          setKostDataMap(newMap);
          setLoading(false);
        };

        myKosts.forEach(kost => {
          const uR = listenRooms(kost.id, (rooms) => {
            kostRooms[kost.id] = rooms;
            updateStats();
          });
          unsubRooms.push(uR);

          const uT = listenTenantsByKost(kost.id, (tenants) => {
            kostTenants[kost.id] = tenants;
            updateStats();
          });
          unsubTenants.push(uT);
        });

        if (myKosts.length === 0) setLoading(false);
      });

      return () => {
        unsubRooms.forEach(u => u());
        unsubTenants.forEach(u => u());
      };
    }
  }, [profile?.uid]);

  const { newReportCount } = useNotifications();

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
          <TouchableOpacity onPress={() => signOut(auth)} style={styles.logoutBtn}>
            <FontAwesome5 name="power-off" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
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
        </View>
      </View>

      <View style={styles.content}>
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
                  onPress={() => setSelectedKostDetail(kost)}
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

        {kosts.some(k => k.status !== 'approved') && (
          <View style={styles.pendingSection}>
            <Text style={styles.sectionTitle}>Status Pengajuan Kost</Text>
            {kosts.filter(k => k.status !== 'approved').map(kost => (
              <View key={kost.id} style={styles.statusCard}>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusName}>{kost.name}</Text>
                  <View style={[styles.badge, styles[`badge_${kost.status}`]]}>
                    <Text style={styles.badgeText}>
                      {kost.status === 'pending' ? 'MENUNGGU VERIFIKASI' : 'DITOLAK'}
                    </Text>
                  </View>
                </View>
                {kost.status === 'rejected' && (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionLabel}>Alasan Penolakan:</Text>
                    <Text style={styles.rejectionText}>{kost.rejectionReason || 'Tidak ada alasan spesifik.'}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
      
      <View style={{ height: 100 }} />

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
  rejectionText: { fontSize: 13, color: '#4A4A4A', marginTop: 4, lineHeight: 18 }
});
