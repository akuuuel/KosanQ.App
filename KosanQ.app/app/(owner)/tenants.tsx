import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Image, ScrollView, Dimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getApprovedOwnerKosts } from '../../src/services/kostService';
import { getRoomsByKost } from '../../src/services/roomService';
import { addTenant, listenTenantsByKost, deactivateTenant } from '../../src/services/tenantService';
import { getUserByEmail, getUserProfile } from '../../src/services/userService';
import { Tenant, Kost, Room, UserProfile } from '../../src/types';
import { CustomInput } from '../../src/components/CustomInput';
import { CustomButton } from '../../src/components/CustomButton';
import { sendMessage } from '../../src/services/chatService';

export default function TenantManagementScreen() {
  const { profile } = useAuth();
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [selectedKost, setSelectedKost] = useState<Kost | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Assign form state
  const [userEmail, setUserEmail] = useState('');
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [searching, setSearching] = useState(false);

  // Detail modal state
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [ktpZoomVisible, setKtpZoomVisible] = useState(false);
  const [savingKtp, setSavingKtp] = useState(false);

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
      const unsubscribe = listenTenantsByKost(selectedKost.id, (data) => {
        setTenants(data);
      });
      fetchAvailableRooms();
      return () => unsubscribe();
    }
  }, [selectedKost]);

  const fetchAvailableRooms = async () => {
    if (!selectedKost) return;
    const allRooms = await getRoomsByKost(selectedKost.id);
    // Make filter case-insensitive to be safer
    setAvailableRooms(allRooms.filter(r => r.status?.toLowerCase() === 'available'));
  };

  const openTenantDetail = async (tenant: Tenant) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const [userProfile, allRooms] = await Promise.all([
        getUserProfile(tenant.userId),
        getRoomsByKost(tenant.kostId)
      ]);
      const room = allRooms.find(r => r.id === tenant.roomId);
      setDetailTenant({
        ...tenant,
        userEmail: userProfile?.email || '',
        userWhatsapp: userProfile?.whatsapp || '',
        userKtpURL: userProfile?.ktpURL || '',
        roomDescription: room?.description || '',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveKtp = async () => {
    if (!detailTenant?.userKtpURL) return;
    setSavingKtp(true);
    try {
      const MediaLibrary = require('expo-media-library');
      const FileSystem = require('expo-file-system');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Diperlukan', 'Berikan izin akses galeri untuk menyimpan foto.');
        return;
      }
      const filename = FileSystem.documentDirectory + `ktp_${detailTenant.userId}.jpg`;
      await FileSystem.downloadAsync(detailTenant.userKtpURL, filename);
      await MediaLibrary.saveToLibraryAsync(filename);
      Alert.alert('Tersimpan', 'Foto KTP berhasil disimpan ke galeri.');
    } catch (e) {
      Alert.alert('Gagal', 'Tidak dapat menyimpan foto KTP.');
    } finally {
      setSavingKtp(false);
    }
  };

  const searchUser = async () => {
    if (!userEmail.trim()) return;
    setSearching(true);
    // In a real app, you'd have a specific getUserByEmail service
    // For now, we'll use a placeholder logic or the user has to provide UID
    // Let's assume the user enters UID for precision in this MVP
    try {
      const u = await getUserByEmail(userEmail.trim());
      if (u) {
        setFoundUser(u);
      } else {
        Alert.alert('Gagal', 'Pengguna tidak ditemukan. Pastikan email benar.');
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan saat mencari pengguna');
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async () => {

    if (!foundUser || !selectedRoomId || !selectedKost) {

      return;
    }
    
    setSubmitting(true);
    try {
      const room = availableRooms.find(r => r.id === selectedRoomId);
      if (!room) {
        Alert.alert('Error', 'Kamar tidak ditemukan atau sudah terisi');
        return;
      }

      await addTenant({
        userId: foundUser.uid,
        userName: foundUser.name,
        userPhoto: foundUser.photoURL || '',
        roomId: selectedRoomId,
        roomNumber: room.roomNumber,
        kostId: selectedKost.id,
        ownerId: profile!.uid,
        startDate: new Date().toISOString(),
        isActive: true
      } as any);
      
      setModalVisible(false);
      resetForm();
      fetchAvailableRooms();
      Alert.alert('Sukses', 'Penghuni berhasil ditambahkan ke kamar ' + room.roomNumber);
    } catch (error) {
      Alert.alert('Error', 'Gagal menambahkan penghuni. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = (tenant: Tenant) => {
    Alert.alert(
      'Keluarkan Penghuni',
      `Apakah Anda yakin ingin mengeluarkan ${tenant.userName} dari kamar ${tenant.roomNumber}? Penghuni akan mendapat notifikasi.`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Ya, Keluarkan', style: 'destructive', onPress: async () => {
            try {
              await deactivateTenant(tenant.id, tenant.roomId);

              // Notify the tenant via chat
              if (profile?.uid) {
                const kostName = selectedKost?.name || 'kost';
                await sendMessage(
                  profile.uid,
                  tenant.userId,
                  `📋 *Pemberitahuan Pengeluaran*\n\nHalo ${tenant.userName}, kami ingin memberitahu bahwa Anda telah dikeluarkan dari kamar ${tenant.roomNumber} di ${kostName} per ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.\n\nTerima kasih telah tinggal bersama kami. Semoga Anda menemukan tempat tinggal baru yang nyaman. 🙏`
                );
              }

              fetchAvailableRooms();
            } catch (e) {
              Alert.alert('Error', 'Gagal mengeluarkan penghuni.');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setUserEmail('');
    setFoundUser(null);
    setSelectedRoomId('');
  };

  const renderTenant = ({ item }: { item: Tenant }) => (
    <TouchableOpacity style={styles.tenantCard} onPress={() => openTenantDetail(item)} activeOpacity={0.8}>
      <View style={styles.avatar}>
        {item.userPhoto ? (
          <Image source={{ uri: item.userPhoto }} style={styles.avatarImg} />
        ) : (
          <FontAwesome5 name="user" size={18} color="#fff" />
        )}
      </View>
      <View style={styles.tenantInfo}>
        <Text style={styles.tenantName}>{item.userName}</Text>
        <Text style={styles.tenantDetail}>Kamar {item.roomNumber}</Text>
        <Text style={styles.tenantDate}>Mulai: {new Date(item.startDate).toLocaleDateString('id-ID')}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={14} color="#CBD5E1" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manajemen Penghuni</Text>
        <Text style={styles.subtitle}>Kelola daftar orang yang menyewa kost Anda</Text>
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
        renderItem={renderTenant}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="users-slash" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>Belum ada penghuni</Text>
            <Text style={styles.emptySubtext}>Klik tombol + untuk menambah penghuni baru</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setModalVisible(true); }}>
        <FontAwesome5 name="plus" size={20} color="#fff" />
      </TouchableOpacity>

      {/* ── Tenant Detail Modal ─────────────────────────────── */}
      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.detailHeader}>
              <Text style={styles.modalTitle}>Detail Penghuni</Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <ActivityIndicator size="large" color="#00AA13" style={{ marginVertical: 40 }} />
            ) : detailTenant ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Avatar & Name */}
                <View style={styles.detailProfileRow}>
                  <View style={styles.detailAvatar}>
                    {detailTenant.userPhoto ? (
                      <Image source={{ uri: detailTenant.userPhoto }} style={styles.avatarImg} />
                    ) : (
                      <FontAwesome5 name="user" size={28} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{detailTenant.userName}</Text>
                    <Text style={styles.detailSince}>Bergabung sejak {new Date(detailTenant.startDate).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</Text>
                  </View>
                </View>

                {/* Room Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Info Kamar</Text>
                  <View style={styles.detailRow}>
                    <FontAwesome5 name="door-open" size={14} color="#00AA13" />
                    <Text style={styles.detailValue}>Kamar {detailTenant.roomNumber}</Text>
                  </View>
                  {detailTenant.roomDescription ? (
                    <View style={styles.detailRow}>
                      <FontAwesome5 name="info-circle" size={14} color="#64748b" />
                      <Text style={styles.detailValue}>{detailTenant.roomDescription}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Contact */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Kontak</Text>
                  {detailTenant.userEmail ? (
                    <View style={styles.detailRow}>
                      <FontAwesome5 name="envelope" size={14} color="#3b82f6" />
                      <Text style={styles.detailValue}>{detailTenant.userEmail}</Text>
                    </View>
                  ) : null}
                  {detailTenant.userWhatsapp ? (
                    <View style={styles.detailRow}>
                      <FontAwesome5 name="whatsapp" size={14} color="#25D366" />
                      <Text style={styles.detailValue}>{detailTenant.userWhatsapp}</Text>
                    </View>
                  ) : <Text style={styles.noDataText}>WhatsApp belum diisi</Text>}
                </View>

                {/* KTP */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Identitas (KTP)</Text>
                  {detailTenant.userKtpURL ? (
                    <>
                      <TouchableOpacity onPress={() => setKtpZoomVisible(true)}>
                        <Image source={{ uri: detailTenant.userKtpURL }} style={styles.ktpThumb} resizeMode="cover" />
                        <View style={styles.ktpOverlay}>
                          <FontAwesome5 name="search-plus" size={18} color="#fff" />
                          <Text style={styles.ktpOverlayText}>Tap untuk zoom</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveKtpBtn, savingKtp && { opacity: 0.6 }]}
                        onPress={handleSaveKtp}
                        disabled={savingKtp}
                      >
                        {savingKtp
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <FontAwesome5 name="download" size={14} color="#fff" />}
                        <Text style={styles.saveKtpText}>{savingKtp ? 'Menyimpan...' : 'Simpan ke Galeri'}</Text>
                      </TouchableOpacity>
                    </>
                  ) : <Text style={styles.noDataText}>KTP belum diunggah</Text>}
                </View>

                {/* Remove action */}
                <TouchableOpacity
                  style={styles.removeFullBtn}
                  onPress={() => { setDetailVisible(false); handleRemove(detailTenant); }}
                >
                  <FontAwesome5 name="user-minus" size={15} color="#EF4444" />
                  <Text style={styles.removeFullText}>Keluarkan Penghuni</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── KTP Zoom Modal ──────────────────────────────────── */}
      <Modal visible={ktpZoomVisible} animationType="fade" transparent>
        <View style={styles.ktpZoomOverlay}>
          <TouchableOpacity style={styles.ktpZoomClose} onPress={() => setKtpZoomVisible(false)}>
            <FontAwesome5 name="times" size={24} color="#fff" />
          </TouchableOpacity>
          {detailTenant?.userKtpURL && (
            <Image
              source={{ uri: detailTenant.userKtpURL }}
              style={styles.ktpZoomImg}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tambah Penghuni</Text>
            
            <View style={styles.searchRow}>
              <View style={{ flex: 1 }}>
                <CustomInput 
                  label="Email Pengguna" 
                  placeholder="Cari email calon penghuni" 
                  value={userEmail} 
                  onChangeText={setUserEmail} 
                />
              </View>
              <TouchableOpacity style={styles.searchBtn} onPress={searchUser} disabled={searching}>
                {searching ? <ActivityIndicator color="#fff" size="small" /> : <FontAwesome5 name="search" size={16} color="#fff" />}
              </TouchableOpacity>
            </View>

            {foundUser && (
              <View style={styles.userFoundCard}>
                <View style={styles.avatarSmall}>
                  {foundUser.photoURL ? <Image source={{ uri: foundUser.photoURL }} style={styles.avatarImg} /> : <FontAwesome5 name="user" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foundName}>{foundUser.name}</Text>
                  <Text style={styles.foundEmail}>{foundUser.email}</Text>
                </View>
              </View>
            )}

            <Text style={styles.label}>Pilih Kamar</Text>
            <View style={styles.roomGrid}>
              {availableRooms.map(room => (
                <TouchableOpacity 
                  key={room.id}
                  style={[styles.roomChip, selectedRoomId === room.id && styles.roomChipActive]}
                  onPress={() => setSelectedRoomId(room.id)}
                >
                  <Text style={[styles.roomChipText, selectedRoomId === room.id && styles.roomChipTextActive]}>
                    Kamar {room.roomNumber}
                  </Text>
                </TouchableOpacity>
              ))}
              {availableRooms.length === 0 && <Text style={styles.noRooms}>Tidak ada kamar kosong</Text>}
            </View>

            <View style={styles.modalActions}>
              <CustomButton 
                title="Tambahkan ke Kamar" 
                onPress={handleAssign} 
                loading={submitting}
                disabled={!foundUser || !selectedRoomId || submitting}
              />
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  tenantCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center', marginRight: 16, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  tenantInfo: { flex: 1 },
  tenantName: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  tenantDetail: { fontSize: 14, color: '#00AA13', fontWeight: '600', marginTop: 2 },
  tenantDate: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  removeBtn: { padding: 10 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 20 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  searchBtn: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  userFoundCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  foundName: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C' },
  foundEmail: { fontSize: 12, color: '#64748b' },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 10 },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  roomChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  roomChipActive: { backgroundColor: '#E6F6E8', borderColor: '#00AA13' },
  roomChipText: { fontSize: 13, color: '#64748b' },
  roomChipTextActive: { color: '#00AA13', fontWeight: 'bold' },
  noRooms: { color: '#EF4444', fontSize: 13, fontStyle: 'italic' },
  modalActions: { marginTop: 10, gap: 10 },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 8 },

  // Detail Modal
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  detailProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  detailAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  detailName: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },
  detailSince: { fontSize: 12, color: '#64748b', marginTop: 4 },
  detailSection: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginBottom: 16 },
  detailSectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  detailValue: { flex: 1, fontSize: 14, color: '#1C1C1C', lineHeight: 20 },
  noDataText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
  ktpThumb: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  ktpOverlay: { position: 'absolute', bottom: 20, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  ktpOverlayText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  saveKtpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 12 },
  saveKtpText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  removeFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, marginTop: 8, marginBottom: 24 },
  removeFullText: { color: '#EF4444', fontWeight: 'bold', fontSize: 15 },

  // KTP Zoom
  ktpZoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  ktpZoomClose: { position: 'absolute', top: 60, right: 24, zIndex: 10, padding: 10 },
  ktpZoomImg: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.6 },
});
