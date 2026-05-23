import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  StatusBar,
  Modal,
  ScrollView as ScrollViewNative,
  Clipboard,
  Alert as RNAlert,
  TextInput
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { getOwnerBookings, updateBookingStatus, deleteBooking } from '../../../src/services/bookingService';
import { getRoomsByKost, updateRoom } from '../../../src/services/roomService';
import { addTenant } from '../../../src/services/tenantService';
import { Booking, Room } from '../../../src/types';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { CustomButton } from '../../../src/components/CustomButton';

export default function OwnerOrdersScreen() {
  const authData = useAuth();
  const profile = authData?.profile;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  
  // Rejection state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);

  // Approval / Room Selection state
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [processingApproval, setProcessingApproval] = useState(false);

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  useEffect(() => {
    if (profile?.uid) {
      fetchBookings();
    }
  }, [profile?.uid]);

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await getOwnerBookings(profile!.uid);
      setBookings(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (item: Booking, status: Booking['status']) => {
    if (status === 'rejected') {
      setTargetBookingId(item.id);
      setRejectionReason('');
      setRejectModalVisible(true);
      return;
    }

    if (status === 'approved') {
      setSelectedBooking(item);
      setLoading(true);
      try {
        const rooms = await getRoomsByKost(item.kostId);
        const avail = rooms.filter(r => r.status === 'available');
        setAvailableRooms(avail);
        if (avail.length === 0) {
          showAlert('Kamar Penuh', 'Tidak ada kamar tersedia di kost ini untuk disewakan.', 'warning');
          return;
        }
        setApproveModalVisible(true);
      } catch (error) {
        showAlert('Error', 'Gagal memuat data kamar.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const confirmApproval = async () => {
    if (!selectedBooking || !selectedRoom) {
      RNAlert.alert('Peringatan', 'Silakan pilih kamar untuk penyewa ini.');
      return;
    }

    setProcessingApproval(true);
    try {
      // 1. Update Booking Status
      await updateBookingStatus(selectedBooking.id, 'approved');

      // 2. Add to Tenants
      await addTenant({
        userId: selectedBooking.userId,
        userName: selectedBooking.userName,
        userEmail: selectedBooking.userEmail,
        userWhatsapp: selectedBooking.userWhatsapp || '',
        kostId: selectedBooking.kostId,
        kostName: selectedBooking.kostName,
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber,
        startDate: new Date().toISOString(),
        status: 'active',
        isActive: true
      });

      // 3. Update Room Status to Occupied
      await updateRoom(selectedRoom.id, { status: 'occupied' });

      setApproveModalVisible(false);
      setSelectedRoom(null);
      fetchBookings();
      showAlert('Berhasil!', `Penyewa telah disetujui dan ditempatkan di Kamar ${selectedRoom.roomNumber}`, 'success');
    } catch (error) {
      console.error(error);
      showAlert('Gagal', 'Terjadi kesalahan saat memproses persetujuan.', 'error');
    } finally {
      setProcessingApproval(false);
    }
  };

  const confirmRejection = async () => {
    if (!targetBookingId || !rejectionReason.trim()) {
      RNAlert.alert('Peringatan', 'Harap masukkan alasan penolakan.');
      return;
    }

    setLoading(true);
    try {
      await updateBookingStatus(targetBookingId, 'rejected', rejectionReason.trim());
      setRejectModalVisible(false);
      fetchBookings();
      showAlert('Sukses', 'Pesanan berhasil ditolak dengan alasan.', 'success');
    } catch (error) {
      showAlert('Error', 'Gagal memproses penolakan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    showAlert(
      'Hapus Riwayat',
      'Apakah Anda yakin ingin menghapus riwayat pesanan ini?',
      'warning',
      async () => {
        setAlertVisible(false);
        try {
          await deleteBooking(id);
          fetchBookings();
          showAlert('Sukses', 'Riwayat berhasil dihapus', 'success');
        } catch (error) {
          showAlert('Error', 'Gagal menghapus riwayat', 'error');
        }
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#00AA13';
      case 'pending': return '#F59E0B';
      case 'rejected': return '#EE2737';
      default: return '#64748b';
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    RNAlert.alert('Berhasil', 'Email telah disalin ke clipboard');
  };

  const renderItem = ({ item }: { item: Booking }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => { setSelectedBooking(item); setDetailVisible(true); }}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.kostImage }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.kostName}>{item.kostName}</Text>
          {item.status !== 'pending' && (
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <FontAwesome5 name="trash-alt" size={14} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.price}>Pendapatan: Rp {item.price.toLocaleString('id-ID')}</Text>
        
        <View style={styles.userInfo}>
          <FontAwesome5 name="user" size={12} color="#64748b" />
          <Text style={styles.userName}>{item.userName || 'User'}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>

        {item.status === 'rejected' && item.rejectionReason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Alasan Penolakan:</Text>
            <Text style={styles.reasonText}>{item.rejectionReason}</Text>
          </View>
        )}
        
        {item.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.rejectBtn]} 
              onPress={() => handleStatusUpdate(item, 'rejected')}
            >
              <Text style={styles.rejectText}>Tolak</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.approveBtn]} 
              onPress={() => handleStatusUpdate(item, 'approved')}
            >
              <Text style={styles.approveText}>Setujui</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manajemen Pesanan</Text>
        <Text style={styles.headerSubtitle}>Kelola penyewa kost Anda</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00AA13" />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <FontAwesome5 name="history" size={40} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyText}>Belum Ada Pesanan</Text>
              <Text style={styles.emptySubtext}>Pesanan dari calon penyewa akan muncul di sini.</Text>
            </View>
          }
          onRefresh={fetchBookings}
          refreshing={loading}
        />
      )}

      {/* Approval Modal (Room Selection) */}
      <Modal visible={approveModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Setujui & Pilih Kamar</Text>
              <TouchableOpacity onPress={() => setApproveModalVisible(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSub}>Pilih salah satu kamar tersedia untuk ditempati oleh {selectedBooking?.userName}.</Text>

            <ScrollViewNative style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <View style={styles.roomSelectionGrid}>
                {availableRooms.map((room) => (
                  <TouchableOpacity 
                    key={room.id}
                    style={[
                      styles.roomSelectBtn, 
                      selectedRoom?.id === room.id && styles.roomSelectBtnActive
                    ]}
                    onPress={() => setSelectedRoom(room)}
                  >
                    <FontAwesome5 
                      name="door-open" 
                      size={20} 
                      color={selectedRoom?.id === room.id ? '#fff' : '#00AA13'} 
                    />
                    <Text style={[
                      styles.roomSelectText,
                      selectedRoom?.id === room.id && styles.roomSelectTextActive
                    ]}>Kamar {room.roomNumber}</Text>
                    <Text style={styles.roomSelectPrice}>Rp {room.price.toLocaleString('id-ID')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollViewNative>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setApproveModalVisible(false)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <CustomButton 
                  title="Konfirmasi & Setujui" 
                  onPress={confirmApproval} 
                  loading={processingApproval}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={rejectModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCentered}>
          <View style={styles.rejectModalContent}>
            <Text style={styles.modalTitle}>Alasan Penolakan</Text>
            <Text style={styles.modalSub}>Berikan alasan mengapa Anda menolak pesanan ini agar calon penyewa memahaminya.</Text>
            
            <TextInput
              style={styles.reasonInput}
              placeholder="Contoh: Maaf, kamar ini sudah penuh atau sedang dalam perbaikan..."
              multiline
              numberOfLines={4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <CustomButton 
                  title="Konfirmasi Tolak" 
                  onPress={confirmRejection} 
                  loading={loading}
                  style={{ backgroundColor: '#EE2737' }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Calon Penghuni</Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <ScrollViewNative showsVerticalScrollIndicator={false}>
                <View style={styles.userProfileSection}>
                  <View style={styles.largeAvatar}>
                    {selectedBooking.userPhoto ? (
                      <Image source={{ uri: selectedBooking.userPhoto }} style={styles.avatarImg} />
                    ) : (
                      <FontAwesome5 name="user" size={30} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.detailUserName}>{selectedBooking.userName}</Text>
                  <TouchableOpacity 
                    style={styles.emailBadge} 
                    onPress={() => copyToClipboard(selectedBooking.userEmail)}
                  >
                    <Text style={styles.detailUserEmail}>{selectedBooking.userEmail}</Text>
                    <FontAwesome5 name="copy" size={12} color="#00AA13" />
                  </TouchableOpacity>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>WhatsApp</Text>
                  <View style={styles.infoValueRow}>
                    <FontAwesome5 name="whatsapp" size={16} color="#10b981" />
                    <Text style={styles.infoText}>{selectedBooking.userWhatsapp || '-'}</Text>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Bio</Text>
                  <Text style={styles.bioText}>{selectedBooking.userBio || 'Tidak ada bio.'}</Text>
                </View>

                {selectedBooking.userKtp && (
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Foto KTP</Text>
                    <Image source={{ uri: selectedBooking.userKtp }} style={styles.ktpImage} resizeMode="contain" />
                  </View>
                )}

                <View style={{ height: 20 }} />
              </ScrollViewNative>
            )}
          </View>
        </View>
      </Modal>

      <CustomAlert 
        visible={alertVisible}
        title={alertData.title}
        message={alertData.message}
        type={alertData.type}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertData.onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#00AA13',
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 20, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardImage: { width: 100, height: '100%' },
  cardContent: { flex: 1, padding: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kostName: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  price: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 8 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  userName: { fontSize: 13, fontWeight: '600', color: '#475569' },
  userEmail: { fontSize: 12, color: '#64748b' },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  approveBtn: { backgroundColor: '#00AA13', borderColor: '#00AA13' },
  rejectBtn: { backgroundColor: '#fff', borderColor: '#EE2737' },
  approveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  rejectText: { color: '#EE2737', fontSize: 12, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    marginBottom: 20,
  },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  userProfileSection: { alignItems: 'center', marginBottom: 24 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
  detailUserName: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },
  emailBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E6F6E8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 8 },
  detailUserEmail: { fontSize: 13, color: '#00AA13', fontWeight: '600' },
  infoSection: { marginBottom: 20 },
  infoLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 15, color: '#1C1C1C' },
  bioText: { fontSize: 14, color: '#4A4A4A', lineHeight: 20 },
  ktpImage: { width: '100%', height: 200, borderRadius: 12, marginTop: 8, backgroundColor: '#f1f5f9' },

  // Room Selection Styles
  roomSelectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  roomSelectBtn: { width: '47%', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 2, borderColor: '#F1F5F9' },
  roomSelectBtnActive: { backgroundColor: '#00AA13', borderColor: '#00AA13' },
  roomSelectText: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C', marginTop: 8 },
  roomSelectTextActive: { color: '#fff' },
  roomSelectPrice: { fontSize: 11, color: '#64748b', marginTop: 4 },
  roomSelectPriceActive: { color: 'rgba(255,255,255,0.8)' },

  // Reject Modal Styles
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  rejectModalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalSub: { fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 18 },
  reasonInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, fontSize: 14, color: '#1C1C1C', borderWidth: 1, borderColor: '#E2E8F0', textAlignVertical: 'top', minHeight: 100, marginBottom: 20 },
  reasonBox: { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#EE2737' },
  reasonLabel: { fontSize: 10, fontWeight: 'bold', color: '#EE2737', marginBottom: 2 },
  reasonText: { fontSize: 11, color: '#4A4A4A' },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#64748b', fontWeight: 'bold' },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
});
