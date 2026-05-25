import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { auth, db } from '../../../src/services/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { CustomAlert } from '../../../src/components/CustomAlert';

import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage } from '../../../src/services/storageService';
import { doc, setDoc } from 'firebase/firestore';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';

import { Linking, Modal } from 'react-native';

export default function UserProfileScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [showInfoModal, setShowInfoModal] = React.useState<{ visible: boolean, title: string, content: string }>({ visible: false, title: '', content: '' });
  const [alertVisible, setAlertVisible] = React.useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      try {
        const uri = result.assets[0].uri;
        const compressed = await compressAndResizeImage(uri);
        const url = await uploadImage(compressed, 'profiles');
        
        const userRef = doc(db, 'users', profile!.uid);
        await setDoc(userRef, { photoURL: url }, { merge: true });
        
        Alert.alert('Sukses', 'Foto profil berhasil diperbarui!');
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Gagal memperbarui foto profil');
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
      title = 'Pusat Bantuan';
      content = 'Hubungi kami melalui WhatsApp: +62 853-4386-9700 atau email: imranzmart023@gmail.com';
    } else if (topic === 'terms') {
      title = 'Syarat & Ketentuan';
      content = '1. Pengguna wajib memberikan data yang valid saat pendaftaran.\n2. KosanQ hanya sebagai platform marketplace dan tidak bertanggung jawab atas sengketa antara owner dan penghuni.\n3. Dilarang menyalahgunakan platform untuk tindak kejahatan atau penipuan.\n4. Data pribadi pengguna akan dijaga kerahasiaannya sesuai kebijakan privasi kami.';
    } else {
      title = 'Tentang KosanQ';
      content = 'KosanQ hadir sebagai solusi modern untuk gaya hidup urban di Indonesia. Kami bukan sekadar aplikasi pencari kost, melainkan ekosistem digital yang menghubungkan pencari kost dengan hunian yang aman, nyaman, dan transparan.\n\nMisi kami adalah mendigitalkan manajemen kos-kosan agar proses sewa-menyewa menjadi lebih simpel, mulai dari pencarian, pembayaran iuran bulanan, hingga komunikasi dengan pemilik kos, semua dalam satu genggaman.';
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
            style={[styles.menuItem, index === items.length - 1 && { borderBottomWidth: 0 }]} 
            onPress={item.onPress}
          >
            <View style={[styles.iconWrapper, { backgroundColor: item.bg || '#F1F5F9' }]}>
              <FontAwesome5 name={item.icon} size={14} color={item.color || '#4A4A4A'} />
            </View>
            <Text style={[styles.menuText, item.isDestructive && { color: '#EE2737' }]}>{item.label}</Text>
            <FontAwesome5 name="chevron-right" size={12} color="#CBD5E1" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        {!profile ? (
          <>
            <SkeletonLoader width={90} height={90} borderRadius={45} style={{ marginBottom: 16 }} />
            <SkeletonLoader width={150} height={20} style={{ marginBottom: 8 }} />
            <SkeletonLoader width={120} height={14} />
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.avatar} onPress={pickImage}>
              {profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.avatarImg} />
              ) : (
                <FontAwesome5 name="user" size={32} color="#fff" />
              )}
              <View style={styles.editBadge}>
                <FontAwesome5 name="camera" size={10} color="#00AA13" />
              </View>
            </TouchableOpacity>
            <Text style={styles.name}>{profile?.name || 'User KosanQ'}</Text>
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
                <Text style={styles.statVal}>{profile?.points || 0}</Text>
                <Text style={styles.statLabel}>Poin</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{profile?.vouchers || 0}</Text>
                <Text style={styles.statLabel}>Voucher</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{profile?.memberStatus || 'Bronze'}</Text>
                <Text style={styles.statLabel}>Member</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <MenuSection 
          title="Akun Saya" 
          items={[
            { icon: 'user-edit', label: 'Ubah Profil', onPress: () => router.push('/(user)/edit-profile') },
            { icon: 'shield-alt', label: 'Keamanan Akun', onPress: handleSecurity },
            { icon: 'bell', label: 'Pengaturan Notifikasi', onPress: () => Linking.openSettings() },
          ]}
        />

        <MenuSection 
          title="Dukungan" 
          items={[
            { icon: 'question-circle', label: 'Pusat Bantuan', onPress: () => handleHelp('help') },
            { icon: 'file-alt', label: 'Syarat & Ketentuan', onPress: () => handleHelp('terms') },
            { icon: 'info-circle', label: 'Tentang KosanQ', onPress: () => handleHelp('about') },
          ]}
        />

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={16} color="#EE2737" />
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </TouchableOpacity>

        <Text style={styles.version}>KosanQ v1.0.4</Text>
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
        message="Apakah Anda yakin ingin keluar dari akun Anda?"
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#fff',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  avatarImg: { width: '100%', height: '100%' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 24,
    width: '85%',
    borderRadius: 20,
    paddingVertical: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statDivider: { width: 1, height: '70%', backgroundColor: '#F1F5F9', alignSelf: 'center' },

  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 12, marginLeft: 4 },
  sectionContent: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { flex: 1, fontSize: 15, marginLeft: 12, color: '#1C1C1C', fontWeight: '500' },
  
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
    padding: 16,
    borderRadius: 20,
    marginTop: 8,
  },
  logoutText: { fontSize: 15, fontWeight: 'bold', color: '#EE2737', marginLeft: 10 },
  version: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 30 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 24, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 12 },
  modalBody: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  closeBtn: { backgroundColor: '#00AA13', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12 },
  closeBtnText: { color: '#fff', fontWeight: 'bold' },
});
