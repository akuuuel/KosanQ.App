import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { Kost } from '../../src/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CustomAlert } from '../../src/components/CustomAlert';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';

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
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        
        <View style={styles.cardMeta}>
          <View style={[styles.statusBadge, styles[`badge_${item.status}`]]}>
            <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
          </View>
          {item.averageRating && (
            <View style={styles.cardRating}>
              <FontAwesome5 name="star" solid size={10} color="#F59E0B" />
              <Text style={styles.ratingText}>{item.averageRating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardLoc} numberOfLines={1}>
          <FontAwesome5 name="map-marker-alt" size={10} /> {item.location}
        </Text>
        
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>Rp {(item.price/1000).toFixed(0)}k</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <FontAwesome5 name="trash-alt" size={12} color="#EF4444" />
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
        <View style={{ padding: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View key={i} style={[styles.card, { padding: 0 }]}>
              <SkeletonLoader width="100%" height={100} />
              <View style={{ padding: 10, gap: 8 }}>
                <SkeletonLoader width="80%" height={15} />
                <SkeletonLoader width="60%" height={10} />
                <SkeletonLoader width="100%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          key={2}
          data={kosts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
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
  list: { padding: 10 },
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 5 },
  card: { backgroundColor: '#fff', borderRadius: 16, width: '48%', marginBottom: 16, overflow: 'hidden', elevation: 3 },
  cardImg: { width: '100%', height: 100 },
  cardContent: { padding: 10 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 13, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 4 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badge_approved: { backgroundColor: '#DCFCE7' },
  badge_pending: { backgroundColor: '#FEF3C7' },
  badge_rejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 8, fontWeight: 'bold', color: '#1C1C1C' },
  cardLoc: { fontSize: 11, color: '#64748b', marginBottom: 8 },
  cardOwner: { fontSize: 10, color: '#94a3b8', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  cardPrice: { fontSize: 13, fontWeight: 'bold', color: '#00AA13' },
  deleteBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyText: { marginTop: 16, color: '#64748b', fontSize: 16, fontWeight: '500' },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  ratingText: { fontSize: 11, fontWeight: 'bold', color: '#F59E0B' },
});
