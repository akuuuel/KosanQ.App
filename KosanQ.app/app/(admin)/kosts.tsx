import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { Kost } from '../../src/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CustomAlert } from '../../src/components/CustomAlert';

export default function AdminKostsScreen() {
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  useEffect(() => {
    fetchKosts();
  }, []);

  const fetchKosts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'kosts'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kost));
      setKosts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const handleDelete = (id: string) => {
    showAlert(
      'Hapus Kost',
      'Apakah Anda yakin ingin menghapus kost ini secara permanen?',
      'warning',
      async () => {
        setAlertVisible(false);
        try {
          await deleteDoc(doc(db, 'kosts', id));
          fetchKosts();
          showAlert('Sukses', 'Kost berhasil dihapus', 'success');
        } catch (error) {
          showAlert('Error', 'Gagal menghapus kost', 'error');
        }
      }
    );
  };

  const renderItem = ({ item }: { item: Kost }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.images[0] }} style={styles.cardImg} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={[styles.statusBadge, styles[`badge_${item.status}`]]}>
            <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
          </View>
          {item.averageRating && (
            <View style={styles.cardRating}>
              <FontAwesome5 name="star" solid size={10} color="#F59E0B" />
              <Text style={styles.ratingText}>{item.averageRating.toFixed(1)} ({item.totalReviews})</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardLoc} numberOfLines={1}>
          <FontAwesome5 name="map-marker-alt" size={10} /> {item.location}
        </Text>
        <Text style={styles.cardOwner}>Owner ID: {item.ownerId.substring(0, 8)}...</Text>
        
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>Rp {item.price.toLocaleString('id-ID')}</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <FontAwesome5 name="trash-alt" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manajemen Properti</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00AA13" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={kosts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome5 name="home" size={50} color="#CBD5E1" />
              <Text style={styles.emptyText}>Belum ada kost terdaftar</Text>
            </View>
          }
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  list: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 16, overflow: 'hidden', elevation: 2 },
  cardImg: { width: '100%', height: 120 },
  cardContent: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badge_approved: { backgroundColor: '#DCFCE7' },
  badge_pending: { backgroundColor: '#FEF3C7' },
  badge_rejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#1C1C1C' },
  cardLoc: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  cardOwner: { fontSize: 10, color: '#94a3b8', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  cardPrice: { fontSize: 15, fontWeight: 'bold', color: '#00AA13' },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyText: { marginTop: 16, color: '#64748b', fontSize: 16, fontWeight: '500' },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  ratingText: { fontSize: 11, fontWeight: 'bold', color: '#F59E0B' },
});
