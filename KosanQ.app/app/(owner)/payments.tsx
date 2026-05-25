import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getApprovedOwnerKosts } from '../../src/services/kostService';
import { listenTenantsByKost } from '../../src/services/tenantService';
import { listenPaymentsByKost, updatePaymentStatus, approvePayment, rejectPayment } from '../../src/services/paymentService';
import { Tenant, Kost, Payment, MonthlyStatus, PaymentHistory } from '../../src/types';
import { CustomInput } from '../../src/components/CustomInput';
import { CustomAlert } from '../../src/components/CustomAlert';

const MONTHS = [
  { id: 'jan', label: 'Jan' }, { id: 'feb', label: 'Feb' }, { id: 'mar', label: 'Mar' },
  { id: 'apr', label: 'Apr' }, { id: 'may', label: 'Mei' }, { id: 'jun', label: 'Jun' },
  { id: 'jul', label: 'Jul' }, { id: 'aug', label: 'Agu' }, { id: 'sep', label: 'Sep' },
  { id: 'oct', label: 'Okt' }, { id: 'nov', label: 'Nov' }, { id: 'dec', label: 'Des' }
];

export default function PaymentManagementScreen() {
  const { profile } = useAuth();
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [selectedKost, setSelectedKost] = useState<Kost | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; type: any; onConfirm?: () => void }>({
    title: '', message: '', type: 'info'
  });

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm });
    setAlertVisible(true);
  };

  useEffect(() => {
    if (profile?.uid) fetchKosts();
  }, [profile?.uid]);

  const fetchKosts = async () => {
    const data = await getApprovedOwnerKosts(profile!.uid);
    setKosts(data);
    if (data.length > 0) setSelectedKost(data[0]);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedKost) {
      const unsubTenants = listenTenantsByKost(selectedKost.id, setTenants);
      const unsubPayments = listenPaymentsByKost(selectedKost.id, setPayments);
      return () => {
        unsubTenants();
        unsubPayments();
      };
    }
  }, [selectedKost]);

  const confirmApprove = async (historyId: string, month: string) => {
    if (!selectedPayment) return;
    try {
      await approvePayment(selectedPayment.id, historyId, month, selectedPayment.history || [], selectedPayment.userId);
      const updatedHistory = (selectedPayment.history || []).map(h => 
        h.id === historyId ? { ...h, status: 'approved' as const } : h
      );
      setSelectedPayment({
        ...selectedPayment,
        history: updatedHistory,
        monthlyStatus: { ...selectedPayment.monthlyStatus, [month]: true }
      });
      showAlert('Sukses', 'Pembayaran telah disetujui.', 'success');
    } catch (e) {
      showAlert('Error', 'Gagal menyetujui pembayaran', 'error');
    }
  };

  const handleApprove = (historyId: string, month: string, tenantName: string) => {
    showAlert(
      'Konfirmasi ACC',
      `Anda yakin ingin menyetujui laporan pembayaran bulan ${month} dari ${tenantName}?`,
      'warning',
      () => confirmApprove(historyId, month)
    );
  };

  const handleReject = async (historyId: string, reason: string) => {
    if (!selectedPayment) return;
    if (!reason.trim()) {
      showAlert('Peringatan', 'Harap isi catatan penolakan.', 'warning');
      return;
    }
    try {
      await rejectPayment(selectedPayment.id, historyId, selectedPayment.history || [], reason);
      const updatedHistory = (selectedPayment.history || []).map(h => 
        h.id === historyId ? { ...h, status: 'rejected' as const, note: reason } : h
      );
      setSelectedPayment({
        ...selectedPayment,
        history: updatedHistory
      });
      showAlert('Sukses', 'Pembayaran telah ditolak.', 'success');
      setRejectNotes(prev => ({...prev, [historyId]: ''}));
    } catch (e) {
      showAlert('Error', 'Gagal menolak pembayaran', 'error');
    }
  };

  const getCurrentMonthStatus = (payment: Payment) => {
    const now = new Date();
    const currentMonthIdx = now.getMonth();
    const monthIds = MONTHS.map(m => m.id);
    const currentMonthId = monthIds[currentMonthIdx];
    
    const isPaid = payment.monthlyStatus[currentMonthId as keyof MonthlyStatus];
    
    if (isPaid) return { label: 'Lunas', color: '#00AA13', bg: '#E6F6E8' };
    
    // Check if there are unpaid months before the current month
    let hasUnpaidBefore = false;
    for (let i = 0; i < currentMonthIdx; i++) {
      if (!payment.monthlyStatus[monthIds[i] as keyof MonthlyStatus]) {
        hasUnpaidBefore = true;
        break;
      }
    }
    
    if (hasUnpaidBefore) return { label: 'Menunggak', color: '#EE2737', bg: '#FEE2E2' };
    
    return { label: 'Belum Lunas', color: '#64748b', bg: '#F1F5F9' };
  };

  const renderTenantPayment = ({ item }: { item: Tenant }) => {
    const payment = payments.find(p => p.tenantId === item.id);
    if (!payment) return null;

    const hasPending = payment.history?.some(h => h.status === 'pending');
    const status = getCurrentMonthStatus(payment);

    return (
      <TouchableOpacity 
        style={styles.paymentCard}
        onPress={() => {
          setSelectedPayment(payment);
          setSelectedTenant(item);
          setShowDetailModal(true);
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.userName}</Text>
            <View style={styles.metaInfo}>
              <FontAwesome5 name="door-open" size={10} color="#64748b" />
              <Text style={styles.roomInfo}>No. {item.roomNumber}</Text>
            </View>
          </View>
          
          <View style={styles.rightSide}>
            {hasPending && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Perlu ACC</Text>
              </View>
            )}
            <View style={[styles.statusBadgeMain, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusTextMain, { color: status.color }]}>{status.label}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#CBD5E1" style={{ marginLeft: 10 }} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manajemen Pembayaran</Text>
        <Text style={styles.subtitle}>Pantau dan verifikasi pembayaran penghuni</Text>
      </View>

      <View style={styles.kostSelector}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={kosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.kostChip, selectedKost?.id === item.id && styles.kostChipActive]}
              onPress={() => setSelectedKost(item)}
            >
              <Text style={[styles.kostChipText, selectedKost?.id === item.id && styles.kostChipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.kostSelectorContent}
        />
      </View>

      <FlatList
        data={tenants}
        keyExtractor={(item) => item.id}
        renderItem={renderTenantPayment}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="money-check-alt" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>Tidak ada data pembayaran</Text>
            <Text style={styles.emptySubtext}>Daftar pembayaran muncul saat ada penghuni aktif</Text>
          </View>
        }
      />

      {/* Payment Detail & History Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Detail Pembayaran</Text>
                <Text style={styles.modalSubtitle}>{selectedTenant?.userName} - Kamar {selectedTenant?.roomNumber}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              <Text style={styles.historySectionTitle}>Status Iuran Bulanan</Text>
              <View style={styles.monthGrid}>
                {MONTHS.map(month => (
                  <View 
                    key={month.id}
                    style={[
                      styles.monthGridItem,
                      selectedPayment?.monthlyStatus[month.id as keyof MonthlyStatus] && styles.monthGridItemPaid
                    ]}
                  >
                    <Text style={[
                      styles.monthGridLabel,
                      selectedPayment?.monthlyStatus[month.id as keyof MonthlyStatus] && styles.monthGridLabelPaid
                    ]}>{month.label}</Text>
                    <FontAwesome5 
                      name={selectedPayment?.monthlyStatus[month.id as keyof MonthlyStatus] ? 'check-circle' : 'clock'} 
                      size={12} 
                      color={selectedPayment?.monthlyStatus[month.id as keyof MonthlyStatus] ? '#00AA13' : '#CBD5E1'} 
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.historySectionTitle}>Riwayat Pembayaran</Text>
              {selectedPayment?.history && selectedPayment.history.length > 0 ? (
                selectedPayment.history.sort((a,b) => b.createdAt - a.createdAt).map((log) => (
                  <View key={log.id} style={styles.historyItem}>
                    <View style={styles.historyItemHeader}>
                      <View>
                        <Text style={styles.historyMonth}>Bulan {MONTHS.find(m => m.id === log.month)?.label}</Text>
                        <Text style={styles.historyDate}>{new Date(log.createdAt).toLocaleString('id-ID')}</Text>
                      </View>
                      <View style={[
                        styles.statusBadge, 
                        log.status === 'approved' ? styles.statusApproved : log.status === 'rejected' ? styles.statusRejected : styles.statusPending
                      ]}>
                        <Text style={styles.statusText}>
                          {log.status === 'approved' ? 'Berhasil' : log.status === 'rejected' ? 'Ditolak' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.historyDetails}>
                      <Text style={styles.detailLabel}>Metode: <Text style={styles.detailVal}>{log.method}</Text></Text>
                      <Text style={styles.detailLabel}>Nominal: <Text style={styles.detailVal}>Rp {log.amount.toLocaleString()}</Text></Text>
                    </View>

                    {log.proofImage && (
                      <View style={styles.proofContainer}>
                        <Text style={styles.proofLabel}>Bukti Pembayaran (Klik untuk zoom):</Text>
                        <TouchableOpacity onPress={() => setZoomImage(log.proofImage)}>
                          <Image source={{ uri: log.proofImage }} style={styles.proofImgDetail} resizeMode="cover" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {log.status === 'pending' && (
                      <View style={{ marginTop: 12 }}>
                        <CustomInput 
                          label="Catatan / Alasan Penolakan" 
                          placeholder="Misl: Nominal kurang, gambar buram"
                          value={rejectNotes[log.id] || ''}
                          onChangeText={(val) => setRejectNotes(prev => ({...prev, [log.id]: val}))}
                        />
                        <View style={styles.actionButtons}>
                          <TouchableOpacity 
                            style={[styles.actionBtn, styles.accBtnStyle]}
                            onPress={() => handleApprove(log.id, log.month, selectedTenant?.userName || 'penghuni')}
                          >
                            <FontAwesome5 name="check" size={14} color="#fff" />
                            <Text style={styles.actionBtnText}>Terima</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.actionBtn, styles.rejectBtnStyle]}
                            onPress={() => handleReject(log.id, rejectNotes[log.id] || '')}
                          >
                            <FontAwesome5 name="times" size={14} color="#fff" />
                            <Text style={styles.actionBtnText}>Tolak</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistory}>
                  <Text style={styles.emptyHistoryText}>Belum ada riwayat transaksi</Text>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Zoom Image Modal */}
      <Modal visible={!!zoomImage} transparent animationType="fade">
        <View style={styles.zoomOverlay}>
          <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomImage(null)}>
            <FontAwesome5 name="times" size={24} color="#fff" />
          </TouchableOpacity>
          {zoomImage && (
            <Image 
              source={{ uri: zoomImage }} 
              style={styles.fullImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>

      <CustomAlert 
        visible={alertVisible}
        title={alertData.title}
        message={alertData.message}
        type={alertData.type}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertData.onConfirm}
        confirmText={alertData.onConfirm ? 'Ya, ACC' : 'OK'}
        cancelText="Batal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingTop: 60, backgroundColor: '#00AA13' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  kostSelector: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  kostSelectorContent: { paddingHorizontal: 20 },
  kostChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 10 },
  kostChipActive: { backgroundColor: '#E6F6E8', borderWidth: 1, borderColor: '#00AA13' },
  kostChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  kostChipTextActive: { color: '#00AA13' },
  listContent: { padding: 20, paddingBottom: 100 },
  paymentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  metaInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  roomInfo: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  rightSide: { flexDirection: 'row', alignItems: 'center' },
  pendingBadge: { backgroundColor: '#EE2737', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8 },
  pendingBadgeText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  statusBadgeMain: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusTextMain: { fontSize: 11, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },
  modalBody: { flex: 1 },
  historySectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', marginTop: 8, marginBottom: 16 },
  
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  monthGridItem: { width: '22.5%', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  monthGridItemPaid: { backgroundColor: '#E6F6E8', borderColor: '#00AA13' },
  monthGridLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  monthGridLabelPaid: { color: '#00AA13' },
  
  historyItem: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  historyItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  historyMonth: { fontSize: 15, fontWeight: 'bold', color: '#1C1C1C' },
  historyDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusApproved: { backgroundColor: '#E6F6E8' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: 'bold', color: '#92400E' },
  
  historyDetails: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  detailLabel: { fontSize: 13, color: '#64748b' },
  detailVal: { fontWeight: 'bold', color: '#1C1C1C' },
  
  proofContainer: { marginBottom: 16 },
  proofLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  proofImgDetail: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F1F5F9' },
  
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  accBtnStyle: { backgroundColor: '#00AA13' },
  rejectBtnStyle: { backgroundColor: '#EE2737' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  
  emptyHistory: { padding: 32, alignItems: 'center' },
  emptyHistoryText: { color: '#94a3b8', fontSize: 14 },
  
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 8 },

  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  zoomClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: '100%', height: '80%' }
});
