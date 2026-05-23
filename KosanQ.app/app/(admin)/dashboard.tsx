import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../src/services/firebase';
import { Kost } from '../../src/types';
import { signOut } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { CustomAlert } from '../../src/components/CustomAlert';

export default function AdminDashboard() {
  const [pendingKosts, setPendingKosts] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  useEffect(() => {
    fetchPendingKosts();
  }, []);

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const fetchPendingKosts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'kosts'), where('status', '==', 'pending'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kost));
      setPendingKosts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (id: string, status: 'approved' | 'rejected') => {
    showAlert(
      'Konfirmasi',
      `Apakah Anda yakin ingin memproses kost ini sebagai ${status === 'approved' ? 'DISETUJUI' : 'DITOLAK'}?`,
      'info',
      async () => {
        setAlertVisible(false);
        try {
          const docRef = doc(db, 'kosts', id);
          await updateDoc(docRef, { status });
          showAlert('Sukses', `Kost berhasil di-${status}`, 'success');
          fetchPendingKosts();
        } catch (error) {
          showAlert('Error', 'Gagal memproses kost', 'error');
        }
      }
    );
  };

  const renderItem = ({ item }: { item: Kost }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.detailRow}>
          <FontAwesome5 name="map-marker-alt" size={10} color="#64748b" />
          <Text style={styles.cardDetail}>{item.location}</Text>
        </View>
        <View style={styles.detailRow}>
          <FontAwesome5 name="tag" size={10} color="#00AA13" />
          <Text style={[styles.cardDetail, { color: '#00AA13', fontWeight: 'bold' }]}>
            Rp {item.price.toLocaleString('id-ID')}
          </Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.approveBtn]} 
          onPress={() => handleAction(item.id, 'approved')}
        >
          <FontAwesome5 name="check" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.rejectBtn]} 
          onPress={() => handleAction(item.id, 'rejected')}
        >
          <FontAwesome5 name="times" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Verifikasi Kost Baru</Text>
        </View>
        <TouchableOpacity onPress={() => signOut(auth)} style={styles.logoutBtn}>
          <FontAwesome5 name="sign-out-alt" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00AA13" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={pendingKosts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <FontAwesome5 name="check-double" size={40} color="#00AA13" />
              </View>
              <Text style={styles.emptyText}>Tidak ada antrian</Text>
              <Text style={styles.emptySubtext}>Semua pengajuan telah diproses.</Text>
            </View>
          }
          onRefresh={fetchPendingKosts}
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
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#00AA13',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  logoutBtn: { padding: 8 },
  listContent: { padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardDetail: { fontSize: 13, color: '#64748b', marginLeft: 8 },
  cardActions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  approveBtn: { backgroundColor: '#00AA13' },
  rejectBtn: { backgroundColor: '#EE2737' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F6E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: { color: '#1C1C1C', fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: '#64748b', fontSize: 14, marginTop: 4 },
});
