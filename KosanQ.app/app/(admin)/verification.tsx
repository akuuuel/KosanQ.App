import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Image, Modal, TextInput, Platform, ScrollView } from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../src/services/firebase';
import { Kost } from '../../src/types';
import { signOut } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { CustomAlert } from '../../src/components/CustomAlert';
import { sendMessage } from '../../src/services/chatService';
import { getKostById } from '../../src/services/kostService';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';

export default function AdminVerificationScreen() {
  const [pendingKosts, setPendingKosts] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);

  // Alert & Modal states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedKostId, setSelectedKostId] = useState<string | null>(null);
  const [selectedKost, setSelectedKost] = useState<Kost | null>(null);
  const [ownerData, setOwnerData] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [showOwnerDocs, setShowOwnerDocs] = useState(false);

  useEffect(() => {
    // Set up real-time listener for pending kosts
    setLoading(true);
    const q = query(collection(db, 'kosts'), where('status', '==', 'pending'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        // Normalize createdAt from Firebase Timestamp to millis
        const createdAt = d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt || 0);
        return { id: doc.id, ...d, createdAt } as Kost;
      });
      
      // Sort in-memory by newest first
      setPendingKosts(data.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (error) => {
      console.error('[Admin Verification] Listener error:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const fetchPendingKosts = () => {
    // This is now redundant but kept for the flatlist onRefresh compatibility
    // The listener handles the updates
  };

  const handleAction = (id: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      setSelectedKostId(id);
      setRejectionReason('');
      setRejectModalVisible(true);
      return;
    }

    showAlert(
      'Konfirmasi Approval',
      'Apakah Anda yakin ingin MENYETUJUI kost ini agar bisa dilihat oleh publik?',
      'info',
      async () => {
        setAlertVisible(false);
        setLoading(true);
        try {
          const kost = await getKostById(id);
          const docRef = doc(db, 'kosts', id);
          await updateDoc(docRef, { status: 'approved' });
          
          if (kost) {
            await sendMessage(
              auth.currentUser!.uid, 
              kost.ownerId, 
              `Selamat! Pengajuan kost "${kost.name}" Anda telah DISETUJUI oleh Admin. Kost Anda kini sudah tayang dan bisa dipesan oleh pencari kost.`
            );
          }

          showAlert('Sukses', 'Kost berhasil disetujui!', 'success');
          fetchPendingKosts();
        } catch (error) {
          showAlert('Error', 'Gagal menyetujui kost', 'error');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const submitRejection = async () => {
    if (!rejectionReason.trim() || !selectedKostId) {
      showAlert('Peringatan', 'Harap masukkan alasan penolakan', 'warning');
      return;
    }

    setProcessing(true);
    try {
      const kost = await getKostById(selectedKostId);
      const docRef = doc(db, 'kosts', selectedKostId);
      await updateDoc(docRef, { 
        status: 'rejected',
        rejectionReason: rejectionReason.trim()
      });

      if (kost) {
        await sendMessage(
          auth.currentUser!.uid, 
          kost.ownerId, 
          `Mohon maaf, pengajuan kost "${kost.name}" Anda DITOLAK oleh Admin.\n\nAlasan: ${rejectionReason.trim()}\n\nSilakan perbaiki data Anda dan ajukan kembali.`
        );
      }

      setRejectModalVisible(false);
      showAlert('Berhasil', 'Kost ditolak dengan alasan yang diberikan.', 'success');
      fetchPendingKosts();
    } catch (error) {
      showAlert('Error', 'Gagal memproses penolakan', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const fetchOwnerData = async (ownerId: string) => {
    setLoadingOwner(true);
    setOwnerData(null);
    try {
      const userRef = doc(db, 'users', ownerId);
      const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', ownerId)));
      if (!userSnap.empty) {
        setOwnerData(userSnap.docs[0].data());
      }
    } catch (error) {
      console.error('Error fetching owner data:', error);
    } finally {
      setLoadingOwner(false);
    }
  };

  const handleOpenDetail = async (kost: Kost) => {
    setSelectedKost(kost);
    setDetailVisible(true);
    await fetchOwnerData(kost.ownerId);
  };

  const renderItem = ({ item }: { item: Kost }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => handleOpenDetail(item)}
    >
      <Image source={{ uri: item.images[0] }} style={styles.cardImg} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.detailRow}>
          <FontAwesome5 name="map-marker-alt" size={10} color="#64748b" />
          <Text style={styles.cardDetail} numberOfLines={1}>{item.location}</Text>
        </View>
        <View style={styles.typeRow}>
          <View style={[styles.typeBadge, { backgroundColor: item.type === 'putra' ? '#3b82f6' : item.type === 'putri' ? '#ec4899' : '#10b981' }]}>
            <Text style={styles.typeBadgeText}>{item.type?.toUpperCase()}</Text>
          </View>
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
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Verifikasi Kost</Text>
          <Text style={styles.subtitle}>{pendingKosts.length} antrian menunggu</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={[styles.card, { padding: 12, gap: 10 }]}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <SkeletonLoader width={70} height={70} borderRadius={12} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonLoader width="80%" height={15} />
                  <SkeletonLoader width="100%" height={12} />
                  <SkeletonLoader width="60%" height={12} />
                </View>
              </View>
            </View>
          ))}
        </View>
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
              <Text style={styles.emptyText}>Tidak Ada Antrian</Text>
              <Text style={styles.emptySubtext}>Semua pengajuan kost sudah bersih.</Text>
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

      <Modal visible={rejectModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Alasan Penolakan</Text>
            <Text style={styles.modalSub}>Sampaikan alasan mengapa pengajuan kost ini ditolak agar pemilik bisa memperbaikinya.</Text>
            
            <TextInput
              style={styles.rejectInput}
              placeholder="Tuliskan alasan penolakan di sini..."
              multiline
              numberOfLines={4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.submitRejectBtn, processing && styles.disabledBtn]} 
                onPress={submitRejection}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitRejectText}>Kirim & Tolak</Text>}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={styles.detailOverlay}>
          <View style={styles.detailContent}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Review Kost</Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedKost && (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageGallery}>
                    {selectedKost.images.map((img, i) => (
                      <Image key={i} source={{ uri: img }} style={styles.detailImage} />
                    ))}
                  </ScrollView>

                  <View style={styles.mainInfo}>
                    <Text style={styles.kostName}>{selectedKost.name}</Text>
                    <Text style={styles.kostPrice}>Rp {selectedKost.price.toLocaleString('id-ID')} / bulan</Text>
                    
                    <View style={styles.infoBadgeRow}>
                      <View style={[styles.typeBadgeLarge, { backgroundColor: selectedKost.type === 'putra' ? '#3b82f6' : selectedKost.type === 'putri' ? '#ec4899' : '#10b981' }]}>
                        <FontAwesome5 name={selectedKost.type === 'putra' ? 'mars' : selectedKost.type === 'putri' ? 'venus' : 'user-friends'} size={12} color="#fff" />
                        <Text style={styles.typeBadgeTextLarge}>{selectedKost.type?.toUpperCase()}</Text>
                      </View>
                    </View>

                    <Text style={styles.detailSectionTitle}>Lokasi</Text>
                    <View style={styles.locationRow}>
                      <FontAwesome5 name="map-marker-alt" size={14} color="#64748b" />
                      <Text style={styles.locationText}>{selectedKost.location}</Text>
                    </View>
                    {selectedKost.latitude && (
                      <View style={styles.coordsBox}>
                        <Text style={styles.coordsText}>Koordinat: {selectedKost.latitude.toFixed(6)}, {selectedKost.longitude?.toFixed(6)}</Text>
                      </View>
                    )}

                    <Text style={styles.detailSectionTitle}>Deskripsi</Text>
                    <Text style={styles.descriptionText}>{selectedKost.description}</Text>

                    <Text style={styles.detailSectionTitle}>Biodata Pemilik</Text>
                    {loadingOwner ? (
                      <ActivityIndicator size="small" color="#00AA13" />
                    ) : ownerData ? (
                      <View style={styles.ownerCardContainer}>
                        {/* Ringkasan — selalu tampil */}
                        <TouchableOpacity
                          style={styles.ownerCard}
                          onPress={() => setShowOwnerDocs(v => !v)}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: ownerData.photoURL || 'https://via.placeholder.com/100' }}
                            style={styles.ownerPhoto}
                          />
                          <View style={styles.ownerInfo}>
                            <Text style={styles.ownerName}>{ownerData.name || 'Tanpa Nama'}</Text>
                            <Text style={styles.ownerEmail}>{ownerData.email}</Text>
                            {ownerData.whatsapp && (
                              <View style={styles.ownerContact}>
                                <FontAwesome5 name="whatsapp" size={14} color="#25D366" />
                                <Text style={styles.ownerWhatsapp}>{ownerData.whatsapp}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.docsToggleBtn}>
                            <FontAwesome5
                              name={showOwnerDocs ? 'chevron-up' : 'chevron-down'}
                              size={12}
                              color="#64748b"
                            />
                            <Text style={styles.docsToggleText}>
                              {showOwnerDocs ? 'Sembunyikan' : 'Lihat Dokumen'}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Dokumen Pendukung — muncul saat diklik */}
                        {showOwnerDocs && (
                          <View style={styles.docsSection}>
                            {ownerData.npwp && (
                              <View style={styles.docRow}>
                                <FontAwesome5 name="file-alt" size={14} color="#64748b" />
                                <View style={{ marginLeft: 10 }}>
                                  <Text style={styles.docLabel}>NPWP</Text>
                                  <Text style={styles.docValue}>{ownerData.npwp}</Text>
                                </View>
                              </View>
                            )}
                            {ownerData.address && (
                              <View style={styles.docRow}>
                                <FontAwesome5 name="map-marker-alt" size={14} color="#64748b" />
                                <View style={{ marginLeft: 10, flex: 1 }}>
                                  <Text style={styles.docLabel}>Alamat (KTP)</Text>
                                  <Text style={styles.docValue}>{ownerData.address}</Text>
                                </View>
                              </View>
                            )}
                            {ownerData.bankName && (
                              <View style={styles.docRow}>
                                <FontAwesome5 name="university" size={14} color="#64748b" />
                                <View style={{ marginLeft: 10 }}>
                                  <Text style={styles.docLabel}>Rekening Bank</Text>
                                  <Text style={styles.docValue}>{ownerData.bankName} • {ownerData.bankAccount}</Text>
                                  <Text style={styles.docSub}>a.n. {ownerData.bankAccountName}</Text>
                                </View>
                              </View>
                            )}
                            {ownerData.ktpURL && (
                              <View style={styles.ktpSection}>
                                <Text style={styles.ktpLabel}>Foto KTP</Text>
                                <Image
                                  source={{ uri: ownerData.ktpURL }}
                                  style={styles.ktpPreview}
                                  resizeMode="contain"
                                />
                              </View>
                            )}
                            {ownerData.selfieKTPURL && (
                              <View style={styles.ktpSection}>
                                <Text style={styles.ktpLabel}>Selfie + KTP</Text>
                                <Image
                                  source={{ uri: ownerData.selfieKTPURL }}
                                  style={styles.ktpPreview}
                                  resizeMode="contain"
                                />
                              </View>
                            )}
                            {ownerData.bio && (
                              <View style={styles.bioSection}>
                                <Text style={styles.bioLabel}>Bio Pemilik</Text>
                                <Text style={styles.ownerBio}>"{ownerData.bio}"</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.errorText}>Data pemilik tidak ditemukan.</Text>
                    )}
                  </View>

                  <View style={styles.detailFooter}>
                    <TouchableOpacity 
                      style={[styles.footerBtn, styles.footerApprove]} 
                      onPress={() => {
                        setDetailVisible(false);
                        handleAction(selectedKost.id, 'approved');
                      }}
                    >
                      <FontAwesome5 name="check" size={16} color="#fff" />
                      <Text style={styles.footerBtnText}>Setujui Kost</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.footerBtn, styles.footerReject]} 
                      onPress={() => {
                        setDetailVisible(false);
                        handleAction(selectedKost.id, 'rejected');
                      }}
                    >
                      <FontAwesome5 name="times" size={16} color="#fff" />
                      <Text style={styles.footerBtnText}>Tolak Kost</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  listContent: { padding: 20, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardImg: { width: 60, height: 60, borderRadius: 12, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  cardDetail: { fontSize: 12, color: '#64748b', marginLeft: 6 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 8 },
  modalSub: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 20 },
  rejectInput: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, fontSize: 14, color: '#1C1C1C', borderWidth: 1, borderColor: '#E2E8F0', textAlignVertical: 'top', marginBottom: 24 },
  modalActions: { gap: 12 },
  submitRejectBtn: { backgroundColor: '#EE2737', padding: 16, borderRadius: 16, alignItems: 'center' },
  submitRejectText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: 'bold' },
  disabledBtn: { opacity: 0.7 },

  // Detail Modal Styles
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', padding: 24 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  detailTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  imageGallery: { marginHorizontal: -24, marginBottom: 20, paddingLeft: 24 },
  detailImage: { width: 280, height: 180, borderRadius: 20, marginRight: 16 },
  mainInfo: { marginBottom: 30 },
  kostName: { fontSize: 24, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 8 },
  kostPrice: { fontSize: 18, color: '#00AA13', fontWeight: 'bold', marginBottom: 16 },
  infoBadgeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  typeBadgeLarge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  typeBadgeTextLarge: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  detailSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', marginTop: 24, marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  locationText: { flex: 1, fontSize: 14, color: '#4A4A4A', lineHeight: 20 },
  coordsBox: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 10 },
  coordsText: { fontSize: 11, color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  descriptionText: { fontSize: 14, color: '#4A4A4A', lineHeight: 22 },
  detailFooter: { flexDirection: 'row', gap: 12, marginTop: 20, paddingBottom: 40 },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16 },
  footerApprove: { backgroundColor: '#00AA13' },
  footerReject: { backgroundColor: '#EE2737' },
  footerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  typeRow: { marginTop: 8 },
  ownerCard: { 
    flexDirection: 'row', 
    backgroundColor: '#F8FAFC', 
    padding: 16, 
    borderRadius: 20, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  ownerPhoto: { width: 60, height: 60, borderRadius: 30, marginRight: 16 },
  ownerInfo: { flex: 1 },
  ownerName: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  ownerEmail: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  ownerContact: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  ownerWhatsapp: { fontSize: 13, color: '#1C1C1C', fontWeight: '600' },
  ownerBio: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  errorText: { fontSize: 12, color: '#EE2737', fontStyle: 'italic' },
  ownerCardContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  docsToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  docsToggleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  docsSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  docLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  docValue: {
    fontSize: 14,
    color: '#1C1C1C',
    fontWeight: '600',
    marginTop: 2,
  },
  docSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  ktpSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  ktpLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  ktpPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  bioSection: {
    marginTop: 12,
  },
  bioLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
});
