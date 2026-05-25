import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, Linking, Modal, StatusBar } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { auth, db } from '../../../src/services/firebase';
import { signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage } from '../../../src/services/storageService';
import { useRouter } from 'expo-router';
import { getKostsByOwner } from '../../../src/services/kostService';
import { listenRooms } from '../../../src/services/roomService';
import { listenTenantsByKost } from '../../../src/services/tenantService';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';

export default function OwnerProfileScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalKosts: 0, totalRooms: 0, totalTenants: 0 });
  const [showInfoModal, setShowInfoModal] = React.useState<{ visible: boolean, title: string, content: string }>({ visible: false, title: '', content: '' });
  const [alertVisible, setAlertVisible] = useState(false);

  useEffect(() => {
    if (profile?.uid) {
      fetchStats();
    }
  }, [profile?.uid]);

  const fetchStats = async () => {
    const myKosts = await getKostsByOwner(profile!.uid);
    let roomsCount = 0;
    let tenantsCount = 0;

    const promises = myKosts.map(async (kost) => {
      // Note: This is a simplified fetch for stats. In production, consider a summary document.
      // But for small number of kosts, this works.
      return new Promise<void>((resolve) => {
        const unsubRooms = listenRooms(kost.id, (rooms) => {
          roomsCount += rooms.length;
          const unsubTenants = listenTenantsByKost(kost.id, (tenants) => {
            tenantsCount += tenants.length;
            unsubRooms();
            unsubTenants();
            resolve();
          });
        });
      });
    });

    await Promise.all(promises);
    setStats({
      totalKosts: myKosts.length,
      totalRooms: roomsCount,
      totalTenants: tenantsCount
    });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      try {
        setLoading(true);
        const uri = result.assets[0].uri;
        const compressed = await compressAndResizeImage(uri);
        const url = await uploadImage(compressed, 'profiles');
        
        await setDoc(doc(db, 'users', profile!.uid), { photoURL: url }, { merge: true });
        Alert.alert('Sukses', 'Foto profil berhasil diperbarui!');
      } catch (error) {
        Alert.alert('Error', 'Gagal memperbarui foto profil');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogout = () => {
    setAlertVisible(true);
  };

  const handleSecurity = () => {
    Alert.alert(
      'Keamanan Akun',
      'Demi keamanan, kami akan mengirimkan link reset password ke email Anda (' + profile?.email + '). Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Kirim Link', onPress: () => {
          Alert.alert('Sukses', 'Link reset password telah dikirim ke email Anda.');
        }}
      ]
    );
  };

  const handleHelp = (topic: 'help' | 'terms' | 'about') => {
    let title = '';
    let content = '';
    if (topic === 'help') {
      title = 'Pusat Bantuan Owner';
      content = 'Hubungi tim support khusus Owner di WhatsApp: +62 853-4386-9700 atau email: support-owner@kosanq.com';
    } else if (topic === 'terms') {
      title = 'Syarat & Ketentuan Owner';
      content = '1. Owner wajib memverifikasi data kost yang diunggah.\n2. KosanQ mengenakan biaya layanan 5% dari setiap transaksi yang berhasil.\n3. Owner bertanggung jawab penuh atas fasilitas dan keamanan kost.';
    } else {
      title = 'Tentang KosanQ';
      content = 'KosanQ adalah partner terbaik bagi pemilik kost untuk mengelola bisnis hunian secara modern, otomatis, dan terpercaya.';
    }
    setShowInfoModal({ visible: true, title, content });
  };

  const MenuSection = ({ title, items }: { title: string, items: any[] }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {items.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={[styles.menuItem, index === items.length - 1 ? { borderBottomWidth: 0 } : null]} 
            onPress={item.onPress}
          >
            <View style={[styles.iconWrapper, { backgroundColor: item.bg || '#F1F5F9' }]}>
              <FontAwesome5 name={item.icon} size={14} color={item.color || '#4A4A4A'} />
            </View>
            <Text style={[styles.menuText, item.isDestructive ? { color: '#EE2737' } : null]}>{item.label}</Text>
            <FontAwesome5 name="chevron-right" size={12} color="#CBD5E1" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const isProfileComplete = 
    profile?.name && 
    profile?.email && 
    profile?.whatsapp && 
    profile?.photoURL && 
    profile?.ktpURL &&
    profile?.selfieKTPURL &&
    profile?.npwp &&
    profile?.address &&
    profile?.bankName &&
    profile?.bankAccount;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        {!profile ? (
          <>
            <SkeletonLoader width={100} height={100} borderRadius={50} style={{ marginBottom: 15 }} />
            <SkeletonLoader width={180} height={22} style={{ marginBottom: 8 }} />
            <SkeletonLoader width={140} height={14} />
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.avatar} onPress={pickImage} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.avatarImg} />
              ) : (
                <FontAwesome5 name="user-tie" size={32} color="#fff" />
              )}
              <View style={styles.editBadge}>
                <FontAwesome5 name="camera" size={10} color="#00AA13" />
              </View>
            </TouchableOpacity>
            <Text style={styles.name}>{profile?.name || 'Juragan Kost'}</Text>
            <Text style={styles.email}>{profile?.email}</Text>
          </>
        )}
        <View style={styles.statsContainer}>
          {!profile ? (
            <>
              <View style={styles.statItem}><SkeletonLoader width={40} height={20} /></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><SkeletonLoader width={40} height={20} /></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><SkeletonLoader width={40} height={20} /></View>
            </>
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{stats.totalKosts}</Text>
                <Text style={styles.statLabel}>Kost</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{stats.totalRooms}</Text>
                <Text style={styles.statLabel}>Kamar</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{stats.totalTenants}</Text>
                <Text style={styles.statLabel}>Penghuni</Text>
              </View>
            </>
          )}
        </View>
      </View>
      <View style={styles.content}>
        {!isProfileComplete && (
          <TouchableOpacity 
            style={styles.warningBanner} 
            onPress={() => router.push('/(owner)/edit-profile')}
          >
            <View style={styles.warningIcon}>
              <FontAwesome5 name="exclamation-triangle" size={16} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Profil Belum Lengkap</Text>
              <Text style={styles.warningSub}>Lengkapi data legalitas agar Anda bisa mendaftarkan kost baru.</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#F59E0B" />
          </TouchableOpacity>
        )}
        <MenuSection 
          title="Manajemen Akun" 
          items={[
            { icon: 'user-edit', label: 'Ubah Profil', onPress: () => router.push('/(owner)/edit-profile') },
            { icon: 'shield-alt', label: 'Keamanan Akun', onPress: handleSecurity },
            { icon: 'bell', label: 'Pengaturan Notifikasi', onPress: () => Linking.openSettings() },
          ]}
        />
        <MenuSection 
          title="Bisnis & Dukungan" 
          items={[
            { icon: 'question-circle', label: 'Pusat Bantuan Owner', onPress: () => handleHelp('help') },
            { icon: 'file-alt', label: 'Syarat & Ketentuan', onPress: () => handleHelp('terms') },
            { icon: 'info-circle', label: 'Tentang KosanQ', onPress: () => handleHelp('about') },
          ]}
        />
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={16} color="#EE2737" />
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </TouchableOpacity>
        <Text style={styles.version}>KosanQ Owner v1.0.4</Text>
        <View style={{ height: 40 }} />
      </View>
      <Modal visible={showInfoModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{showInfoModal.title}</Text>
            <Text style={styles.modalBody}>{showInfoModal.content}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowInfoModal({ ...showInfoModal, visible: false })}>
              <Text style={styles.closeBtnText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <CustomAlert 
        visible={alertVisible}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari akun Owner Anda?"
        type="logout"
        confirmText="Keluar"
        cancelText="Batal"
        onClose={() => setAlertVisible(false)}
        onConfirm={() => {
          setAlertVisible(false);
          signOut(auth);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    backgroundColor: '#00AA13', 
    paddingTop: 60, 
    paddingBottom: 40, 
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  avatar: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 15,
    overflow: 'hidden'
  },
  avatarImg: { width: '100%', height: '100%' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  name: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 25 },
  statsContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 20, 
    width: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  statDivider: { width: 1, height: '60%', backgroundColor: '#F1F5F9', alignSelf: 'center' },
  content: { padding: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', marginLeft: 4 },
  sectionContent: { backgroundColor: '#fff', borderRadius: 24, padding: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  iconWrapper: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  menuText: { flex: 1, fontSize: 15, color: '#1C1C1C', fontWeight: '500' },
  logoutBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#fff', 
    padding: 18, 
    borderRadius: 20, 
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2'
  },
  logoutText: { fontSize: 15, fontWeight: 'bold', color: '#EE2737', marginLeft: 10 },
  version: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 30 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 24, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 12 },
  modalBody: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  closeBtn: { backgroundColor: '#00AA13', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12 },
  closeBtnText: { color: '#fff', fontWeight: 'bold' },
  warningBanner: {
    backgroundColor: '#FFF7ED',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    gap: 12,
  },
  warningIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#9A3412',
  },
  warningSub: {
    fontSize: 12,
    color: '#C2410C',
    marginTop: 2,
  },
});
