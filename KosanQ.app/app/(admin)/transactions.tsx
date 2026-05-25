import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Modal, TextInput, ScrollView } from 'react-native';
import { collection, getDocs, query, orderBy, addDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CustomAlert } from '../../src/components/CustomAlert';
import { getDocs as getDocsUtil } from 'firebase/firestore';

const TX_TYPES = ['Biaya Pendaftaran Kost', 'Komisi Bulanan', 'Perpanjangan Langganan', 'Denda Pelanggaran', 'Lainnya'];

export default function AdminTransactionsScreen() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any });
  const router = useRouter();

  // New transaction form
  const [selectedOwner, setSelectedOwner] = useState<any>(null);
  const [txType, setTxType] = useState(TX_TYPES[0]);
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txStatus, setTxStatus] = useState<'paid' | 'unpaid'>('paid');
  const [saving, setSaving] = useState(false);

  const showAlert = (title: string, message: string, type: any = 'info') => {
    setAlertData({ title, message, type });
    setAlertVisible(true);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch admin transactions only
      const txQuery = query(collection(db, 'adminTransactions'), orderBy('createdAt', 'desc'));
      const txSnap = await getDocs(txQuery);
      const txData = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txData);

      // Fetch all owners for the add form
      const usersQuery = query(collection(db, 'users'), where('role', '==', 'owner'));
      const usersSnap = await getDocs(usersQuery);
      const ownersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOwners(ownersData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!selectedOwner) { showAlert('Peringatan', 'Pilih pemilik kost terlebih dahulu.', 'warning'); return; }
    if (!txAmount || isNaN(parseInt(txAmount))) { showAlert('Peringatan', 'Masukkan nominal yang valid.', 'warning'); return; }

    setSaving(true);
    try {
      await addDoc(collection(db, 'adminTransactions'), {
        ownerId: selectedOwner.id,
        ownerName: selectedOwner.name || selectedOwner.email,
        ownerEmail: selectedOwner.email,
        type: txType,
        amount: parseInt(txAmount),
        note: txNote,
        status: txStatus,
        createdAt: Timestamp.now(),
      });
      setShowAddModal(false);
      setTxAmount('');
      setTxNote('');
      setSelectedOwner(null);
      setTxStatus('paid');
      await fetchData();
      showAlert('Sukses', 'Transaksi berhasil dicatat.', 'success');
    } catch (e) {
      showAlert('Error', 'Gagal mencatat transaksi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const createdAt = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: item.status === 'paid' ? '#DCFCE7' : '#FEF3C7' }]}>
            <FontAwesome5 name={item.status === 'paid' ? 'check-circle' : 'clock'} size={16} color={item.status === 'paid' ? '#00AA13' : '#F59E0B'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kostName}>{item.type}</Text>
            <Text style={styles.date}>{createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={[styles.statusBadge, item.status === 'paid' ? styles.badgePaid : styles.badgeUnpaid]}>
            <Text style={styles.statusText}>{item.status === 'paid' ? 'LUNAS' : 'BELUM'}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Text style={styles.label}>Pemilik Kost</Text>
            <Text style={styles.value}>{item.ownerName}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.label}>Nominal</Text>
            <Text style={styles.totalValue}>Rp {item.amount?.toLocaleString('id-ID')}</Text>
          </View>
        </View>

        {item.note ? (
          <Text style={styles.noteText}>📝 {item.note}</Text>
        ) : null}
      </View>
    );
  };

  const totalPaid = transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalUnpaid = transactions.filter(t => t.status === 'unpaid').reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1C1C1C" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome5 name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Transaksi Admin</Text>
            <Text style={styles.headerSub}>Owner ↔ Platform</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Masuk</Text>
            <Text style={[styles.summaryVal, { color: '#4ade80' }]}>Rp {totalPaid.toLocaleString('id-ID')}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={styles.summaryLabel}>Belum Lunas</Text>
            <Text style={[styles.summaryVal, { color: '#fbbf24' }]}>Rp {totalUnpaid.toLocaleString('id-ID')}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
        <FontAwesome5 name="plus" size={14} color="#fff" />
        <Text style={styles.addBtnText}>Catat Transaksi Baru</Text>
      </TouchableOpacity>

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
              <Text style={styles.emptySub}>Catat transaksi antara pemilik kost dan platform.</Text>
            </View>
          }
        />
      )}

      {/* Add Transaction Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Catat Transaksi</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Pemilik Kost</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {owners.map(owner => (
                  <TouchableOpacity
                    key={owner.id}
                    style={[styles.ownerChip, selectedOwner?.id === owner.id && styles.ownerChipActive]}
                    onPress={() => setSelectedOwner(owner)}
                  >
                    <Text style={[styles.ownerChipText, selectedOwner?.id === owner.id && styles.ownerChipTextActive]}>
                      {owner.name || owner.email}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Jenis Transaksi</Text>
              <View style={{ marginBottom: 16 }}>
                {TX_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, txType === t && styles.typeBtnActive]}
                    onPress={() => setTxType(t)}
                  >
                    <Text style={[styles.typeBtnText, txType === t && styles.typeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Nominal (Rp)</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: 150000"
                keyboardType="numeric"
                value={txAmount}
                onChangeText={setTxAmount}
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.fieldLabel}>Catatan (opsional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Tambahkan catatan..."
                multiline
                value={txNote}
                onChangeText={setTxNote}
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusRow}>
                {(['paid', 'unpaid'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusBtn, txStatus === s && (s === 'paid' ? styles.statusBtnPaid : styles.statusBtnUnpaid)]}
                    onPress={() => setTxStatus(s)}
                  >
                    <FontAwesome5 name={s === 'paid' ? 'check-circle' : 'clock'} size={14} color={txStatus === s ? '#fff' : '#64748b'} />
                    <Text style={[styles.statusBtnText, txStatus === s && { color: '#fff' }]}>{s === 'paid' ? 'Lunas' : 'Belum Lunas'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddTransaction} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Menyimpan...' : 'Simpan Transaksi'}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertData.title}
        message={alertData.message}
        type={alertData.type}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  header: { backgroundColor: '#1C1C1C', padding: 24, paddingTop: 60 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14 },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' },
  summaryVal: { fontSize: 18, fontWeight: 'bold' },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#00AA13', margin: 20, padding: 14, borderRadius: 16 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  typeIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  kostName: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C' },
  date: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgePaid: { backgroundColor: '#DCFCE7' },
  badgeUnpaid: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#1C1C1C' },
  details: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 14, gap: 12 },
  detailItem: { flex: 1 },
  label: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 13, fontWeight: '600', color: '#1C1C1C' },
  totalValue: { fontSize: 14, fontWeight: 'bold', color: '#00AA13' },
  noteText: { fontSize: 12, color: '#64748b', marginTop: 10, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, fontStyle: 'italic' },

  empty: { marginTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { marginTop: 16, color: '#64748b', fontSize: 16, fontWeight: '600' },
  emptySub: { marginTop: 8, color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 10 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, fontSize: 15, color: '#1C1C1C', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },

  ownerChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  ownerChipActive: { backgroundColor: '#00AA13', borderColor: '#00AA13' },
  ownerChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  ownerChipTextActive: { color: '#fff' },

  typeBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#F8FAFC', marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  typeBtnActive: { backgroundColor: '#E6F6E8', borderColor: '#00AA13' },
  typeBtnText: { fontSize: 14, color: '#64748b' },
  typeBtnTextActive: { color: '#00AA13', fontWeight: '600' },

  statusRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statusBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  statusBtnPaid: { backgroundColor: '#00AA13', borderColor: '#00AA13' },
  statusBtnUnpaid: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  statusBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },

  saveBtn: { backgroundColor: '#1C1C1C', padding: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
