import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AdminTransactionsScreen() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.typeIcon}>
          <FontAwesome5 name="receipt" size={16} color="#00AA13" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kostName}>{item.kostName}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
        <View style={[styles.statusBadge, (styles as any)[`badge_${item.status}`] || (styles as any).badge_pending]}>
          <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.label}>Penyewa</Text>
          <Text style={styles.value}>{item.userName}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.label}>Durasi</Text>
          <Text style={styles.value}>{item.duration} Bulan</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.totalValue}>Rp {item.totalPrice?.toLocaleString('id-ID')}</Text>
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
        <Text style={styles.headerTitle}>Riwayat Transaksi</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00AA13" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome5 name="file-invoice-dollar" size={50} color="#CBD5E1" />
              <Text style={styles.emptyText}>Belum ada transaksi</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  list: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  typeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  kostName: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  date: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badge_completed: { backgroundColor: '#DCFCE7' },
  badge_approved: { backgroundColor: '#DCFCE7' },
  badge_pending: { backgroundColor: '#FEF3C7' },
  badge_cancelled: { backgroundColor: '#FEE2E2' },
  badge_rejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#1C1C1C' },
  details: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 },
  detailItem: { flex: 1 },
  label: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 13, fontWeight: '600', color: '#1C1C1C' },
  totalValue: { fontSize: 13, fontWeight: 'bold', color: '#00AA13' },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyText: { marginTop: 16, color: '#64748b', fontSize: 16, fontWeight: '500' }
});
