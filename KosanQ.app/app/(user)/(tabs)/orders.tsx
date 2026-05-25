import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { getUserBookings, deleteBooking } from '../../../src/services/bookingService';
import { Booking } from '../../../src/types';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';

export default function UserOrdersScreen() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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
      const data = await getUserBookings(profile!.uid);
      setBookings(data);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      // Jika error karena index, kita bisa coba fallback atau beri info
      showAlert('Error', 'Gagal memuat riwayat. Silakan coba lagi.', 'error');
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

  const renderItem = ({ item }: { item: Booking }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.kostImage }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.kostName}>{item.kostName}</Text>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <FontAwesome5 name="trash-alt" size={14} color="#94a3b8" />
          </TouchableOpacity>
        </View>
        <Text style={styles.price}>Rp {item.price.toLocaleString('id-ID')} / bulan</Text>
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

        <Text style={styles.date}>Dipesan pada: {new Date(item.createdAt).toLocaleDateString('id-ID')}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Riwayat Pesanan</Text>
        <Text style={styles.headerSubtitle}>Riwayat penyewaan kost Anda</Text>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.card}>
              <SkeletonLoader width={100} height={120} />
              <View style={[styles.cardContent, { gap: 8 }]}>
                <SkeletonLoader width={120} height={20} />
                <SkeletonLoader width={140} height={15} />
                <SkeletonLoader width={80} height={20} borderRadius={6} />
                <SkeletonLoader width={100} height={10} style={{ marginTop: 8 }} />
              </View>
            </View>
          ))}
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
                <FontAwesome5 name="clipboard-list" size={40} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyText}>Belum Ada Pesanan</Text>
              <Text style={styles.emptySubtext}>Cari kost impianmu dan ajukan sewa sekarang!</Text>
            </View>
          }
          onRefresh={fetchBookings}
          refreshing={loading}
        />
      )}

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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardImage: { width: 100, height: '100%' },
  cardContent: { flex: 1, padding: 12 },
  kostName: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  price: { fontSize: 13, color: '#00AA13', fontWeight: 'bold', marginTop: 4 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  date: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
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
  reasonBox: { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#EE2737' },
  reasonLabel: { fontSize: 10, fontWeight: 'bold', color: '#EE2737', marginBottom: 2 },
  reasonText: { fontSize: 11, color: '#4A4A4A' },
});
