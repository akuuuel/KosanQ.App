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
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { useNotifications } from '../../../src/context/NotificationContext';
import { getTenantByUserId } from '../../../src/services/tenantService';
import { sanitizeText } from '../../../src/utils/validation';
import { getKostById } from '../../../src/services/kostService';
import { getRoomById } from '../../../src/services/roomService';
import { listenBroadcasts } from '../../../src/services/broadcastService';
import { listenUserReports, createReport, markUserReportsAsSeen } from '../../../src/services/reportService';
import { listenPaymentByTenant, addPaymentHistory } from '../../../src/services/paymentService';
import { useVoucher } from '../../../src/services/loyaltyService';
import { Tenant, Kost, Room, Broadcast, Report } from '../../../src/types';
import { CustomButton } from '../../../src/components/CustomButton';
import { CustomInput } from '../../../src/components/CustomInput';
import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage } from '../../../src/services/storageService';
import { createReview, hasUserReviewed, listenKostReviews } from '../../../src/services/reviewService';
import { Review } from '../../../src/types';

type TabType = 'detail' | 'pembayaran' | 'pemberitahuan' | 'riwayat';

const MONTHS = [
  { id: 'jan', label: 'Jan' }, { id: 'feb', label: 'Feb' }, { id: 'mar', label: 'Mar' },
  { id: 'apr', label: 'Apr' }, { id: 'may', label: 'Mei' }, { id: 'jun', label: 'Jun' },
  { id: 'jul', label: 'Jul' }, { id: 'aug', label: 'Agu' }, { id: 'sep', label: 'Sep' },
  { id: 'oct', label: 'Okt' }, { id: 'nov', label: 'Nov' }, { id: 'dec', label: 'Des' }
];

export default function UserMyRoomScreen() {
  const { profile } = useAuth();
  const { markBroadcastsAsSeen, newBroadcastCount } = useNotifications();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [kost, setKost] = useState<Kost | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [payment, setPayment] = useState<any | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('detail');
  
  // Report Modal
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportText, setReportText] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Transfer Bank');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [isVoucherApplied, setIsVoucherApplied] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // History Detail Modal
  const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  // Review State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [userAlreadyReviewed, setUserAlreadyReviewed] = useState(false);
  const [kostReviews, setKostReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (profile?.uid) {
      fetchTenantData();
    }
  }, [profile?.uid]);

  useEffect(() => {
    if (profile?.uid && tenant?.kostId) {

      const unsubBroadcasts = listenBroadcasts(tenant.kostId, (data) => setBroadcasts(data));
      const unsubReports = listenUserReports(profile.uid, tenant.kostId, (data) => setReports(data));
      const unsubPayment = listenPaymentByTenant(tenant.id, profile.uid, (data) => setPayment(data));
      const unsubReviews = listenKostReviews(tenant.kostId, (data) => setKostReviews(data));
      
      // Check if user already reviewed
      hasUserReviewed(tenant.kostId, profile.uid).then(setUserAlreadyReviewed);

      return () => {
        unsubBroadcasts();
        unsubReports();
        unsubPayment();
        unsubReviews();
      };
    }
  }, [profile?.uid, tenant?.kostId]);

  useEffect(() => {
    if (activeTab === 'riwayat' && profile?.uid) {
      markUserReportsAsSeen(profile.uid);
    }
    if (activeTab === 'pemberitahuan') {
      markBroadcastsAsSeen();
    }
  }, [activeTab, profile?.uid]);

  const fetchTenantData = async () => {
    setLoading(true);
    try {

      const tenantData = await getTenantByUserId(profile!.uid);
      
      if (tenantData) {
        setTenant(tenantData);

        
        try {
          const [kostData, roomData] = await Promise.all([
            getKostById(tenantData.kostId),
            getRoomById(tenantData.roomId)
          ]);
          setKost(kostData);
          setRoom(roomData);

        } catch (err) {
          console.error("[MyKost] Error fetching Kost or Room details:", err);
        }
      } else {

      }
    } catch (error) {
      console.error("[MyKost] Primary fetch error (Tenant):", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!reportText.trim() || !tenant) return;
    setSubmittingReport(true);
    try {
      await createReport({
        userId: profile!.uid,
        userName: profile!.name,
        ownerId: kost!.ownerId,
        kostId: tenant.kostId,
        roomId: tenant.roomId,
        roomNumber: tenant.roomNumber,
        message: sanitizeText(reportText),
        status: 'pending',
        createdAt: Date.now()
      });
      setReportText('');
      setReportModalVisible(false);
      Alert.alert('Sukses', 'Laporan Anda telah terkirim ke pemilik kost.');
    } catch (error) {
      Alert.alert('Error', 'Gagal mengirim laporan.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setProofUri(result.assets[0].uri);
  };

  const handleSubmitPayment = async () => {
    if (!payment || !selectedMonth || !payAmount || !proofUri) {
      Alert.alert('Peringatan', 'Harap isi semua data dan pilih bukti transfer.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const amount = parseInt(payAmount);
      const finalAmount = isVoucherApplied ? amount - 50000 : amount;

      const compressed = await compressAndResizeImage(proofUri);
      const uploadUrl = await uploadImage(compressed, 'payments');
      
      await addPaymentHistory(payment.id, {
        month: selectedMonth,
        amount: finalAmount,
        method: isVoucherApplied ? `${payMethod} (Voucher Digunakan)` : payMethod,
        proofImage: uploadUrl,
        status: 'pending',
        createdAt: Date.now()
      });

      if (isVoucherApplied && profile) {
        await useVoucher(profile.uid);
      }

      Alert.alert('Sukses', 'Laporan pembayaran Anda telah dikirim. Tunggu konfirmasi dari pemilik kost.');
      setShowPayModal(false);
      setProofUri(null);
      setPayAmount('');
      setIsVoucherApplied(false);
    } catch (e) {
      Alert.alert('Error', 'Gagal mengirim laporan pembayaran.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSendReview = async () => {
    if (!reviewComment.trim() || !tenant || !profile) return;
    setIsSubmittingReview(true);
    try {
      await createReview({
        kostId: tenant.kostId,
        userId: profile.uid,
        userName: profile.name || 'User',
        userPhoto: profile.photoURL || '',
        rating,
        comment: sanitizeText(reviewComment),
        createdAt: Date.now()
      });
      setReviewComment('');
      setReviewModalVisible(false);
      setUserAlreadyReviewed(true);
      Alert.alert('Sukses', 'Terima kasih atas ulasan Anda!');
    } catch (error: any) {
      console.error('[Review] Detail Error:', error);
      Alert.alert('Error', `Gagal mengirim ulasan: ${error.message || 'Error tidak dikenal'}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00AA13" />
      </View>
    );
  }

  if (!tenant || !kost || !room) {
    return (
      <View style={styles.emptyContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kamar Saya</Text>
          <Text style={styles.headerSubtitle}>Status hunian Anda</Text>
        </View>
        <View style={styles.emptyContent}>
          <FontAwesome5 name="door-closed" size={80} color="#E2E8F0" />
          <Text style={styles.emptyTitle}>Belum Ada Kamar</Text>
          <Text style={styles.emptySub}>Informasi kamar akan muncul setelah Anda ditambahkan oleh pemilik kost.</Text>
        </View>
      </View>
    );
  }

  // Logic for Notification vs History
  const now = Date.now();
  const activeBroadcasts = broadcasts.filter(b => now - b.createdAt < 24 * 60 * 60 * 1000);
  const expiredBroadcasts = broadcasts.filter(b => now - b.createdAt >= 24 * 60 * 60 * 1000);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'detail':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.roomGallery}>
              {room.images && room.images.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {room.images.map((img, idx) => (
                    <Image key={idx} source={{ uri: img }} style={styles.roomImg} />
                  ))}
                </ScrollView>
              ) : (
                <Image source={{ uri: kost.images[0] }} style={styles.roomImg} />
              )}
            </View>

            <View style={styles.detailSection}>
              <View style={styles.titleRow}>
                <Text style={styles.roomTitle}>Kamar {room.roomNumber}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Aktif</Text>
                </View>
              </View>
              <Text style={styles.kostInfo}>{kost.name} • {kost.location}</Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.sectionLabel}>Deskripsi Kamar</Text>
              <Text style={styles.description}>{room.description || 'Tidak ada deskripsi khusus untuk kamar ini.'}</Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.sectionLabel}>Fasilitas Kamar</Text>
              <View style={styles.facilityGrid}>
                {room.facilities?.map((f, i) => (
                  <View key={i} style={styles.facilityChip}>
                    <FontAwesome5 name="check-circle" size={12} color="#00AA13" />
                    <Text style={styles.facilityText}>{f}</Text>
                  </View>
                )) || <Text style={styles.emptySub}>Tidak ada info fasilitas.</Text>}
              </View>
            </View>

            <View style={styles.actionSection}>
              <TouchableOpacity 
                style={styles.reportBtn} 
                onPress={() => setReportModalVisible(true)}
              >
                <FontAwesome5 name="exclamation-triangle" size={16} color="#fff" />
                <Text style={styles.reportBtnText}>Lapor Masalah ke Owner</Text>
              </TouchableOpacity>

              {!userAlreadyReviewed && (
                <TouchableOpacity 
                  style={styles.reviewBtn} 
                  onPress={() => setReviewModalVisible(true)}
                >
                  <FontAwesome5 name="star" size={16} color="#fff" />
                  <Text style={styles.reportBtnText}>Beri Rating & Ulasan</Text>
                </TouchableOpacity>
              )}
            </View>

            {kostReviews.length > 0 && (
              <View style={styles.reviewsSection}>
                <Text style={styles.sectionLabel}>Ulasan Penghuni ({kostReviews.length})</Text>
                {kostReviews.slice(0, 3).map((r) => (
                  <View key={r.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewUser}>{r.userName}</Text>
                      <View style={styles.starsRow}>
                        {[1,2,3,4,5].map(s => (
                          <FontAwesome5 key={s} name="star" solid={s <= r.rating} size={10} color={s <= r.rating ? "#F59E0B" : "#CBD5E1"} />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>{r.comment}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        );

      case 'pembayaran':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Status Iuran {new Date().getFullYear()}</Text>
              <View style={styles.monthGrid}>
                {MONTHS.map(month => {
                  const isPaid = payment?.monthlyStatus?.[month.id];
                  const hasPending = payment?.history?.some((h: any) => h.month === month.id && h.status === 'pending');
                  
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
                payment.history.sort((a: any, b: any) => b.createdAt - a.createdAt).map((h: any) => (
                  <TouchableOpacity 
                    key={h.id} 
                    style={styles.historyItemRow}
                    onPress={() => {
                      setSelectedHistory(h);
                      setShowHistoryDetailModal(true);
                    }}
                  >
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyMonth}>{MONTHS.find(m => m.id === h.month)?.label}</Text>
                      <Text style={styles.historyItemDate}>{new Date(h.createdAt).toLocaleDateString('id-ID')}</Text>
                    </View>
                    <View style={[styles.statusBadge, h.status === 'approved' ? styles.statusApproved : h.status === 'pending' ? styles.statusPending : styles.statusRejected]}>
                      <Text style={[styles.statusText, { fontSize: 10 }]}>{h.status === 'approved' ? 'Lunas' : h.status === 'pending' ? 'Menunggu' : 'Ditolak'}</Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noHistory}>Belum ada riwayat transaksi</Text>
              )}
            </View>
            <View style={{ height: 100 }} />
          </ScrollView>
        );

      case 'pemberitahuan':
        return (
          <FlatList
            data={activeBroadcasts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.notifCard}>
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifTime}>Baru</Text>
                </View>
                <Text style={styles.notifMsg}>{item.message}</Text>
                <Text style={styles.notifAuthor}>Oleh: {item.author}</Text>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <FontAwesome5 name="bell-slash" size={40} color="#CBD5E1" />
                <Text style={styles.emptyListText}>Tidak ada pemberitahuan baru</Text>
              </View>
            }
          />
        );

      case 'riwayat':
        const historyItems = [
          ...expiredBroadcasts.map(b => ({ ...b, type: 'broadcast' as const })),
          ...reports.map(r => ({ ...r, type: 'report' as const }))
        ].sort((a, b) => b.createdAt - a.createdAt);

        return (
          <FlatList
            data={historyItems}
            keyExtractor={(item, idx) => idx.toString()}
            renderItem={({ item }) => (
              <View style={[styles.historyCard, item.type === 'report' && styles.historyCardReport]}>
                <View style={styles.historyHeader}>
                  <View style={styles.historyType}>
                    <FontAwesome5 
                      name={item.type === 'report' ? 'exclamation-circle' : 'bullhorn'} 
                      size={12} 
                      color={item.type === 'report' ? '#EE2737' : '#64748b'} 
                    />
                    <Text style={[styles.historyTypeText, item.type === 'report' && { color: '#EE2737' }]}>
                      {item.type === 'report' ? 'Laporan Anda' : 'Pengumuman Lampau'}
                    </Text>
                  </View>
                  <Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                
                <Text style={styles.historyMsg}>
                  {item.type === 'report' ? (item as Report).message : (item as Broadcast).message}
                </Text>

                {item.type === 'report' && (item as Report).response && (
                  <View style={styles.responseBox}>
                    <Text style={styles.responseLabel}>Tanggapan Owner:</Text>
                    <Text style={styles.responseText}>{(item as Report).response}</Text>
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <FontAwesome5 name="history" size={40} color="#CBD5E1" />
                <Text style={styles.emptyListText}>Belum ada riwayat</Text>
              </View>
            }
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kamar Saya</Text>
        <Text style={styles.headerSubtitle}>Kelola hunian Anda</Text>
      </View>

      <View style={styles.tabBar}>
        {(['detail', 'pembayaran', 'pemberitahuan', 'riwayat'] as TabType[]).map((t) => {
          const showBadge = (t === 'pemberitahuan' && activeBroadcasts.length > 0) || 
                           (t === 'riwayat' && reports.filter(r => r.status === 'done' && !r.responseAt).length > 0); 
          
          let badgeCount = 0;
          if (t === 'pemberitahuan') badgeCount = activeBroadcasts.length;
          if (t === 'riwayat') badgeCount = reports.filter(r => r.status === 'done').length;

          const getIcon = () => {
            switch(t) {
              case 'detail': return 'info-circle';
              case 'pembayaran': return 'wallet';
              case 'pemberitahuan': return 'bell';
              case 'riwayat': return 'history';
            }
          };

          return (
            <TouchableOpacity 
              key={t} 
              style={[styles.tabItem, activeTab === t && styles.tabItemActive]}
              onPress={() => setActiveTab(t)}
            >
              <View style={styles.tabLabelContainer}>
                <FontAwesome5 
                  name={getIcon()} 
                  size={14} 
                  color={activeTab === t ? '#00AA13' : '#64748b'} 
                />
                <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                  {t === 'pembayaran' ? 'Bayar' : t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
                {t === 'pemberitahuan' && newBroadcastCount > 0 && (
                  <View style={styles.inlineBadge}>
                    <Text style={styles.inlineBadgeText}>{newBroadcastCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {renderTabContent()}
      </View>

      {/* Report Modal */}
      <Modal visible={reportModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lapor Masalah</Text>
            <Text style={styles.modalSub}>Sampaikan kendala fasilitas atau keluhan Anda kepada pemilik kost.</Text>
            
            <TextInput
              style={styles.reportInput}
              placeholder="Tulis laporan Anda di sini..."
              multiline
              numberOfLines={5}
              value={reportText}
              onChangeText={setReportText}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <CustomButton 
                  title="Kirim Laporan" 
                  onPress={handleSendReport} 
                  loading={submittingReport}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.paymentModalOverlay}>
              <View style={styles.paymentModalContent}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Lapor Pembayaran</Text>
                  <TouchableOpacity onPress={() => setShowPayModal(false)}>
                    <FontAwesome5 name="times" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.monthTarget}>Bulan: {MONTHS.find(m => m.id === selectedMonth)?.label}</Text>
                
                <View style={styles.payInputGroup}>
                  <Text style={styles.payLabel}>Nominal Pembayaran</Text>
                  <TextInput 
                    style={styles.payInput}
                    placeholder="Contoh: 1500000" 
                    value={payAmount} 
                    onChangeText={setPayAmount} 
                    keyboardType="numeric" 
                  />
                  {isVoucherApplied && (
                    <Text style={styles.voucherDiscount}>Potongan Voucher: -Rp 50.000</Text>
                  )}
                </View>

                {profile?.vouchers && profile.vouchers > 0 && !isVoucherApplied && (
                  <TouchableOpacity 
                    style={styles.voucherPicker} 
                    onPress={() => setIsVoucherApplied(true)}
                  >
                    <FontAwesome5 name="ticket-alt" size={16} color="#00AA13" />
                    <Text style={styles.voucherPickerText}>Gunakan 1 Voucher (Potongan Rp 50.000)</Text>
                  </TouchableOpacity>
                )}

                {isVoucherApplied && (
                  <TouchableOpacity 
                    style={[styles.voucherPicker, { borderColor: '#EE2737' }]} 
                    onPress={() => setIsVoucherApplied(false)}
                  >
                    <FontAwesome5 name="times-circle" size={16} color="#EE2737" />
                    <Text style={[styles.voucherPickerText, { color: '#EE2737' }]}>Batalkan Penggunaan Voucher</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.payLabel}>Metode Pembayaran</Text>
                <View style={styles.methodList}>
                  {['Transfer Bank', 'Tunai / Cash'].map(m => (
                    <TouchableOpacity 
                      key={m} 
                      style={[styles.methodBtn, payMethod === m && styles.methodBtnActive]}
                      onPress={() => setPayMethod(m)}
                    >
                      <Text style={[styles.methodText, payMethod === m && styles.methodTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.payLabel}>Bukti Transfer</Text>
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
                  loading={submittingPayment} 
                  style={{ marginTop: 20 }}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Beri Rating & Ulasan</Text>
            <Text style={styles.modalSub}>Bagaimana pengalaman Anda tinggal di {kost?.name}?</Text>
            
            <View style={styles.starSelection}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                  <FontAwesome5 
                    name="star" 
                    size={32} 
                    solid={s <= rating} 
                    color={s <= rating ? "#F59E0B" : "#CBD5E1"} 
                    style={{ marginHorizontal: 5 }}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reportInput}
              placeholder="Tulis ulasan Anda di sini..."
              multiline
              numberOfLines={4}
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReviewModalVisible(false)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <CustomButton 
                  title="Kirim Ulasan" 
                  onPress={handleSendReview} 
                  loading={isSubmittingReview}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Detail Modal (Read-Only) */}
      <Modal visible={showHistoryDetailModal} transparent animationType="fade">
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Detail Transaksi</Text>
              <TouchableOpacity onPress={() => setShowHistoryDetailModal(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedHistory && (
              <View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bulan:</Text>
                  <Text style={styles.detailValue}>{MONTHS.find(m => m.id === selectedHistory.month)?.label}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tanggal:</Text>
                  <Text style={styles.detailValue}>{new Date(selectedHistory.createdAt).toLocaleString('id-ID')}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nominal:</Text>
                  <Text style={styles.detailValue}>Rp {selectedHistory.amount.toLocaleString()}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Metode:</Text>
                  <Text style={styles.detailValue}>{selectedHistory.method}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[styles.statusBadge, selectedHistory.status === 'approved' ? styles.statusApproved : selectedHistory.status === 'pending' ? styles.statusPending : styles.statusRejected]}>
                    <Text style={styles.statusText}>{selectedHistory.status.toUpperCase()}</Text>
                  </View>
                </View>

                {selectedHistory.proofImage && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={styles.payLabel}>Bukti Pembayaran:</Text>
                    <Image source={{ uri: selectedHistory.proofImage }} style={styles.proofPreviewDetail} />
                  </View>
                )}
                
                <CustomButton 
                  title="Tutup" 
                  onPress={() => setShowHistoryDetailModal(false)} 
                  style={{ marginTop: 30, backgroundColor: '#64748b' }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#00AA13', paddingTop: 60, paddingBottom: 50, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    backgroundColor: '#fff', 
    marginHorizontal: 20, 
    marginTop: -30, 
    borderRadius: 20, 
    elevation: 8, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    padding: 8,
    justifyContent: 'space-between'
  },
  tabItem: { 
    width: '48.5%', 
    paddingVertical: 14, 
    alignItems: 'center', 
    borderRadius: 12, 
    marginBottom: 4 
  },
  tabItemActive: { backgroundColor: '#E6F6E8' },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#00AA13' },
  tabContent: { flex: 1 },
  roomGallery: { padding: 20 },
  roomImg: { width: 300, height: 200, borderRadius: 15, marginRight: 15, backgroundColor: '#E2E8F0' },
  detailSection: { padding: 20, backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, elevation: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  roomTitle: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1C' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusApproved: { backgroundColor: '#E6F6E8' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  kostInfo: { fontSize: 14, color: '#64748b', marginBottom: 15 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 8 },
  description: { fontSize: 14, color: '#4A4A4A', lineHeight: 22 },
  facilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  facilityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  facilityText: { fontSize: 12, color: '#4A4A4A' },
  actionSection: { padding: 20 },
  reportBtn: { backgroundColor: '#EE2737', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 15, elevation: 3 },
  reportBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  listContent: { padding: 20 },
  notifCard: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#00AA13', elevation: 2 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notifTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  notifTime: { fontSize: 10, color: '#00AA13', fontWeight: 'bold' },
  notifMsg: { fontSize: 14, color: '#4A4A4A', lineHeight: 20 },
  notifAuthor: { fontSize: 11, color: '#94a3b8', marginTop: 10, fontStyle: 'italic' },
  historyCard: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 15, elevation: 1 },
  historyCardReport: { borderLeftWidth: 4, borderLeftColor: '#EE2737' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyType: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyTypeText: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
  noHistory: { color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 },
  historyDate: { fontSize: 11, color: '#94a3b8' },
  historyItemDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  historyMsg: { fontSize: 14, color: '#4A4A4A' },
  responseBox: { marginTop: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  responseLabel: { fontSize: 11, fontWeight: 'bold', color: '#00AA13', marginBottom: 4 },
  responseText: { fontSize: 13, color: '#1C1C1C' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 16 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthItem: { width: '30%', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  monthPaid: { backgroundColor: '#E6F6E8', borderColor: '#00AA13' },
  monthPending: { backgroundColor: '#FFF7ED', borderColor: '#F59E0B' },
  monthText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  monthTextActive: { color: '#1C1C1C' },
  hintText: { fontSize: 11, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' },
  historyItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyInfo: { flex: 1 },
  historyMonth: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C' },
  paymentModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  paymentModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthTarget: { fontSize: 16, color: '#00AA13', fontWeight: 'bold', marginBottom: 20 },
  payInputGroup: { marginBottom: 20 },
  payLabel: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  payInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 15, fontSize: 14, color: '#1C1C1C', borderWidth: 1, borderColor: '#E2E8F0' },
  methodList: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  methodBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  methodBtnActive: { backgroundColor: '#E6F6E8', borderColor: '#00AA13' },
  methodText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  methodTextActive: { color: '#00AA13' },
  
  proofPicker: { width: '100%', height: 150, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', overflow: 'hidden' },
  pickerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  pickerText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  proofPreview: { width: '100%', height: '100%' },
  proofPreviewDetail: { width: '100%', height: 250, borderRadius: 16, marginTop: 10, backgroundColor: '#F1F5F9' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailLabel: { fontSize: 14, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C' },

  voucherPicker: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#00AA13', 
    borderStyle: 'dashed',
    marginBottom: 16,
    backgroundColor: '#F0FDF4'
  },
  voucherPickerText: { marginLeft: 10, fontSize: 13, color: '#00AA13', fontWeight: 'bold' },
  voucherDiscount: { fontSize: 12, color: '#EE2737', fontWeight: 'bold', marginTop: 4 },

  emptyContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C', marginTop: 20 },
  emptySub: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 10 },
  emptyList: { alignItems: 'center', marginTop: 100 },
  emptyListText: { fontSize: 14, color: '#94a3b8', marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 8 },
  modalSub: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  reportInput: { backgroundColor: '#F8FAFC', borderRadius: 15, padding: 15, fontSize: 14, color: '#1C1C1C', borderWidth: 1, borderColor: '#E2E8F0', textAlignVertical: 'top', marginBottom: 20 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cancelBtn: { padding: 16 },
  cancelText: { color: '#64748b', fontWeight: 'bold' },
  tabLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineBadge: { backgroundColor: '#EF4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  inlineBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  reviewBtn: { backgroundColor: '#00AA13', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 15, elevation: 3, marginTop: 10 },
  reviewsSection: { padding: 20, backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, elevation: 2, marginTop: 20 },
  reviewItem: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 12 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewUser: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C' },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, color: '#4A4A4A', lineHeight: 18 },
  starSelection: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
});
