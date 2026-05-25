import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getTenantByUserId } from '../../src/services/tenantService';
import { listenPaymentByTenant, uploadPaymentProof, addPaymentHistory } from '../../src/services/paymentService';
import { getRoomById } from '../../src/services/roomService';
import { getKostById } from '../../src/services/kostService';
import { Tenant, Payment, MonthlyStatus, PaymentHistory, Room, Kost } from '../../src/types';
import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage } from '../../src/services/storageService';
import { CustomButton } from '../../src/components/CustomButton';
import { CustomInput } from '../../src/components/CustomInput';
import { CustomAlert } from '../../src/components/CustomAlert';

const MONTHS = [
  { id: 'jan', label: 'Januari' }, { id: 'feb', label: 'Februari' }, { id: 'mar', label: 'Maret' },
  { id: 'apr', label: 'April' }, { id: 'may', label: 'Mei' }, { id: 'jun', label: 'Juni' },
  { id: 'jul', label: 'Juli' }, { id: 'aug', label: 'Agustus' }, { id: 'sep', label: 'September' },
  { id: 'oct', label: 'Oktober' }, { id: 'nov', label: 'November' }, { id: 'dec', label: 'Desember' }
];

export default function MyRoomScreen() {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [kost, setKost] = useState<Kost | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'payment'>('info');
  
  // Payment States
  const [showPayModal, setShowPayModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Transfer Bank');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any });

  const showAlert = (title: string, message: string, type: any = 'info') => {
    setAlertData({ title, message, type });
    setAlertVisible(true);
  };

  useEffect(() => {
    if (profile?.uid) fetchTenantData();
  }, [profile?.uid]);

  const fetchTenantData = async () => {
    try {
      const data = await getTenantByUserId(profile!.uid);
      setTenant(data);
      if (data) {
        const [roomData, kostData] = await Promise.all([
          getRoomById(data.roomId),
          getKostById(data.kostId)
        ]);
        setRoom(roomData);
        setKost(kostData);
        
        const unsub = listenPaymentByTenant(data.id, profile!.uid, setPayment);
        setLoading(false);
        return () => unsub();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setProofUri(result.assets[0].uri);
  };

  const handleSubmitPayment = async () => {
    if (!payment || !selectedMonth || !amount || !proofUri) {
      showAlert('Peringatan', 'Harap isi semua data dan pilih bukti transfer.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const compressed = await compressAndResizeImage(proofUri);
      const uploadUrl = await uploadImage(compressed, 'payments');
      
      await addPaymentHistory(payment.id, {
        month: selectedMonth,
        amount: parseInt(amount),
        method,
        proofImage: uploadUrl,
        status: 'pending',
        createdAt: Date.now()
      });

      setShowPayModal(false);
      setProofUri(null);
      setAmount('');
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 400);
    } catch (e) {
      setShowPayModal(false);
      setTimeout(() => {
        showAlert('Error', 'Gagal mengirim laporan pembayaran.', 'error');
      }, 400);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00AA13" />
      </View>
    );
  }

  if (!tenant) {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="home" size={60} color="#CBD5E1" />
        <Text style={styles.emptyText}>Anda belum terdaftar di kamar manapun</Text>
        <Text style={styles.emptySubtext}>Hubungi pemilik kost untuk didaftarkan sebagai penghuni.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kamar Saya</Text>
        <Text style={styles.roomBadge}>{kost?.name} - No. {tenant.roomNumber}</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'info' && styles.activeTab]}
          onPress={() => setActiveTab('info')}
        >
          <FontAwesome5 name="info-circle" size={14} color={activeTab === 'info' ? '#00AA13' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>Info Kamar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'payment' && styles.activeTab]}
          onPress={() => setActiveTab('payment')}
        >
          <FontAwesome5 name="wallet" size={14} color={activeTab === 'payment' ? '#00AA13' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'payment' && styles.activeTabText]}>Pembayaran</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'info' ? (
          <View style={styles.tabContent}>
            {room?.images && room.images.length > 0 ? (
              <Image source={{ uri: room.images[0] }} style={styles.roomImage} />
            ) : (
              <View style={styles.noImage}>
                <FontAwesome5 name="image" size={40} color="#CBD5E1" />
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Detail Properti</Text>
              <View style={styles.infoRow}>
                <FontAwesome5 name="building" size={14} color="#64748b" style={styles.infoIcon} />
                <View>
                  <Text style={styles.infoLabel}>Nama Kost</Text>
                  <Text style={styles.infoVal}>{kost?.name}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <FontAwesome5 name="map-marker-alt" size={14} color="#64748b" style={styles.infoIcon} />
                <View>
                  <Text style={styles.infoLabel}>Alamat</Text>
                  <Text style={styles.infoVal}>{kost?.location}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <FontAwesome5 name="door-open" size={14} color="#64748b" style={styles.infoIcon} />
                <View>
                  <Text style={styles.infoLabel}>Nomor Kamar</Text>
                  <Text style={styles.infoVal}>{tenant.roomNumber}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <FontAwesome5 name="calendar-alt" size={14} color="#64748b" style={styles.infoIcon} />
                <View>
                  <Text style={styles.infoLabel}>Mulai Menghuni</Text>
                  <Text style={styles.infoVal}>{new Date(tenant.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Fasilitas Kamar</Text>
              <View style={styles.facilityGrid}>
                {room?.facilities?.map((f, i) => (
                  <View key={i} style={styles.facilityItem}>
                    <FontAwesome5 name="check-circle" size={12} color="#00AA13" />
                    <Text style={styles.facilityText}>{f}</Text>
                  </View>
                )) || <Text style={styles.emptySub}>Tidak ada info fasilitas.</Text>}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Status Iuran {new Date().getFullYear()}</Text>
              <View style={styles.monthGrid}>
                {MONTHS.map(month => {
                  const isPaid = payment?.monthlyStatus[month.id as keyof MonthlyStatus];
                  const hasPending = payment?.history?.some(h => h.month === month.id && h.status === 'pending');
                  
                  return (
                    <TouchableOpacity 
                      key={month.id} 
                      style={[styles.monthItem, isPaid && styles.monthPaid, hasPending && styles.monthPending]}
                      onPress={() => {
                        if (!isPaid) {
                          setSelectedMonth(month.id);
                          setShowPayModal(true);
                        }
                      }}
                    >
                      <Text style={[styles.monthText, (isPaid || hasPending) && styles.monthTextActive]}>{month.label}</Text>
                      <FontAwesome5 
                        name={isPaid ? "check-circle" : hasPending ? "clock" : "times-circle"} 
                        size={14} 
                        color={isPaid ? "#00AA13" : hasPending ? "#F59E0B" : "#CBD5E1"} 
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.hintText}>*Klik bulan yang belum lunas untuk lapor pembayaran.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Riwayat Transaksi</Text>
              {payment?.history && payment.history.length > 0 ? (
                payment.history.sort((a,b) => b.createdAt - a.createdAt).map((h) => (
                  <View key={h.id} style={styles.historyItemWrapper}>
                    <View style={styles.historyItemRow}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyMonth}>{MONTHS.find(m => m.id === h.month)?.label}</Text>
                        <Text style={styles.historyDate}>{new Date(h.createdAt).toLocaleDateString('id-ID')}</Text>
                      </View>
                      <View style={[styles.statusBadge, h.status === 'approved' ? styles.statusApproved : h.status === 'pending' ? styles.statusPending : styles.statusRejected]}>
                        <Text style={[styles.statusText, h.status === 'approved' ? {color: '#00AA13'} : h.status === 'pending' ? {color: '#F59E0B'} : {color: '#EE2737'}]}>
                          {h.status === 'approved' ? 'Lunas' : h.status === 'pending' ? 'Menunggu' : 'Ditolak'}
                        </Text>
                      </View>
                    </View>
                    
                    {h.status === 'rejected' && h.note && (
                      <View style={styles.rejectNoteContainer}>
                        <FontAwesome5 name="info-circle" size={14} color="#EE2737" />
                        <Text style={styles.rejectNoteText}>Alasan ditolak: {h.note}</Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noHistory}>Belum ada riwayat transaksi</Text>
              )}
            </View>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Payment Modal remains the same */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lapor Pembayaran</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.monthTarget}>Bulan: {MONTHS.find(m => m.id === selectedMonth)?.label}</Text>
            
            <CustomInput 
              label="Nominal Pembayaran" 
              placeholder="Contoh: 1500000" 
              value={amount} 
              onChangeText={setAmount} 
              keyboardType="numeric" 
            />

            <Text style={styles.label}>Metode Pembayaran</Text>
            <View style={styles.methodList}>
              {['Transfer Bank', 'Tunai / Cash'].map(m => (
                <TouchableOpacity 
                  key={m} 
                  style={[styles.methodBtn, method === m && styles.methodBtnActive]}
                  onPress={() => setMethod(m)}
                >
                  <Text style={[styles.methodText, method === m && styles.methodTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Bukti Transfer</Text>
            <TouchableOpacity style={styles.proofPicker} onPress={pickImage}>
              {proofUri ? (
                <Image source={{ uri: proofUri }} style={styles.proofPreview} />
              ) : (
                <View style={styles.pickerContent}>
                  <FontAwesome5 name="camera" size={24} color="#00AA13" />
                  <Text style={styles.pickerText}>Pilih Foto Bukti</Text>
                </View>
              )}
            </TouchableOpacity>

            <CustomButton 
              title="Kirim Laporan" 
              onPress={handleSubmitPayment} 
              loading={submitting} 
              style={{ marginTop: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* DEDICATED SUCCESS MODAL */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconTop}>
              <View style={styles.successIconInner}>
                <FontAwesome5 name="check" size={40} color="#fff" />
              </View>
            </View>
            <Text style={styles.successTitle}>Hore! Terkirim 🎉</Text>
            <Text style={styles.successMessage}>Laporan pembayaran Anda untuk bulan <Text style={{fontWeight: 'bold', color: '#1C1C1C'}}>{MONTHS.find(m => m.id === selectedMonth)?.label}</Text> berhasil dikirim.</Text>
            
            <View style={styles.successInfoBox}>
              <View style={styles.successInfoRow}>
                <Text style={styles.successInfoLabel}>Nominal:</Text>
                <Text style={styles.successInfoVal}>Rp {parseInt(amount || '0').toLocaleString('id-ID')}</Text>
              </View>
              <View style={styles.successInfoRowLine} />
              <View style={styles.successInfoRow}>
                <Text style={styles.successInfoLabel}>Metode:</Text>
                <Text style={styles.successInfoVal}>{method}</Text>
              </View>
            </View>

            <Text style={styles.successWaitText}>Pemilik kost akan segera meninjau laporan Anda.</Text>
            
            <TouchableOpacity 
              style={styles.successBtn} 
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successBtnText}>Kembali ke Kamar</Text>
            </TouchableOpacity>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60, backgroundColor: '#00AA13', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, zIndex: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  roomBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8, fontSize: 14, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginTop: 10, marginHorizontal: 20, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, zIndex: 5 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#00AA13' },
  tabText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  activeTabText: { color: '#00AA13' },
  tabContent: { padding: 20 },
  
  roomImage: { width: '100%', height: 200, borderRadius: 24, marginBottom: 20 },
  noImage: { width: '100%', height: 200, borderRadius: 24, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  
  infoCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  infoIcon: { width: 24 },
  infoLabel: { fontSize: 12, color: '#64748b' },
  infoVal: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C', marginTop: 2 },
  
  facilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  facilityItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  facilityText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 16 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthItem: { width: '30%', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  monthPaid: { backgroundColor: '#E6F6E8', borderColor: '#00AA13' },
  monthPending: { backgroundColor: '#FFF7ED', borderColor: '#F59E0B' },
  monthText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  monthTextActive: { color: '#1C1C1C' },
  hintText: { fontSize: 11, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' },
  
  historyItemWrapper: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rejectNoteContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, marginTop: 10, gap: 8, borderWidth: 1, borderColor: '#FEE2E2' },
  rejectNoteText: { color: '#EE2737', fontSize: 12, lineHeight: 18, flex: 1 },
  historyInfo: { flex: 1 },
  historyMonth: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C' },
  historyDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusApproved: { backgroundColor: '#E6F6E8' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  noHistory: { color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },
  monthTarget: { fontSize: 16, color: '#00AA13', fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 12, marginTop: 16 },
  methodList: { flexDirection: 'row', gap: 10 },
  methodBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  methodBtnActive: { backgroundColor: '#E6F6E8', borderColor: '#00AA13' },
  methodText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  methodTextActive: { color: '#00AA13' },
  
  proofPicker: { width: '100%', height: 150, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', marginTop: 8, overflow: 'hidden' },
  pickerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  pickerText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  proofPreview: { width: '100%', height: '100%' },

  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginTop: 20, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },

  // Success Modal Styles
  successOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  successCard: { width: '100%', backgroundColor: '#fff', borderRadius: 32, padding: 24, paddingTop: 60, alignItems: 'center', position: 'relative' },
  successIconTop: { position: 'absolute', top: -50, width: 100, height: 100, backgroundColor: '#E6F6E8', borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 6, borderColor: '#fff' },
  successIconInner: { width: 70, height: 70, backgroundColor: '#00AA13', borderRadius: 35, justifyContent: 'center', alignItems: 'center', shadowColor: '#00AA13', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#1C1C1C', marginBottom: 16, textAlign: 'center' },
  successMessage: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 24, marginBottom: 24, paddingHorizontal: 10 },
  successInfoBox: { width: '100%', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  successInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successInfoRowLine: { height: 1, backgroundColor: '#E2E8F0', borderStyle: 'dashed', marginVertical: 12 },
  successInfoLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  successInfoVal: { fontSize: 15, color: '#1C1C1C', fontWeight: 'bold' },
  successWaitText: { fontSize: 13, color: '#00AA13', backgroundColor: '#E6F6E8', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, fontWeight: '600', marginBottom: 32 },
  successBtn: { width: '100%', backgroundColor: '#00AA13', paddingVertical: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#00AA13', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  successBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
