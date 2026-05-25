import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { CustomInput } from '../../src/components/CustomInput';
import { CustomButton } from '../../src/components/CustomButton';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage } from '../../src/services/storageService';

export default function OwnerEditProfileScreen() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [ktpURL, setKtpURL] = useState(profile?.ktpURL || '');
  const [selfieKTPURL, setSelfieKTPURL] = useState(profile?.selfieKTPURL || '');
  const [npwp, setNpwp] = useState(profile?.npwp || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [bankName, setBankName] = useState(profile?.bankName || '');
  const [bankAccount, setBankAccount] = useState(profile?.bankAccount || '');
  const [bankAccountName, setBankAccountName] = useState(profile?.bankAccountName || '');
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const pickImage = async (type: 'profile' | 'ktp' | 'selfie') => {
    const showOptions = () => {
      Alert.alert(
        'Pilih Sumber Foto',
        'Pilih foto dari galeri atau ambil foto baru dengan kamera',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Buka Galeri', onPress: () => processImage('gallery', type) },
          { text: 'Ambil Foto (Kamera)', onPress: () => processImage('camera', type) },
        ]
      );
    };

    const processImage = async (mode: 'gallery' | 'camera', type: 'profile' | 'ktp' | 'selfie') => {
      let result;
      
      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Izin Ditolak', 'Maaf, kami butuh izin kamera untuk mengambil foto.', 'error');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          allowsEditing: type === 'profile',
          aspect: [type === 'profile' ? 1 : 4, type === 'profile' ? 1 : 3],
          quality: 0.7,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: type === 'profile',
          aspect: [type === 'profile' ? 1 : 4, type === 'profile' ? 1 : 3],
          quality: 0.7,
        });
      }

      if (!result.canceled) {
        setUploading(true);
        try {
          const compressedBase64 = await compressAndResizeImage(result.assets[0].uri);
          const folder = type === 'profile' ? 'avatars' : type === 'ktp' ? 'ktp' : 'selfie-ktp';
          const url = await uploadImage(compressedBase64, folder);
          
          if (type === 'profile') setPhotoURL(url);
          else if (type === 'ktp') setKtpURL(url);
          else if (type === 'selfie') setSelfieKTPURL(url);
        } catch (error) {
          showAlert('Error', 'Gagal mengunggah gambar. Silakan coba lagi.', 'error');
        } finally {
          setUploading(false);
        }
      }
    };

    showOptions();
  };

  const handleSave = async () => {
    if (!name.trim() || !whatsapp.trim()) {
      showAlert('Error', 'Nama dan WhatsApp wajib diisi', 'warning');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', profile!.uid);
      await setDoc(userRef, {
        name: name.trim(),
        bio: bio.trim(),
        whatsapp: whatsapp.trim(),
        photoURL,
        ktpURL,
        selfieKTPURL,
        npwp: npwp.trim(),
        address: address.trim(),
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
        bankAccountName: bankAccountName.trim(),
        updatedAt: Date.now()
      }, { merge: true });
      
      showAlert('Sukses!', 'Profil Legalitas Anda berhasil diperbarui.', 'success', () => {
        setAlertVisible(false);
        router.back();
      });
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Gagal memperbarui profil. Silakan coba lagi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.title}>Lengkapi Profil Legalitas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foto Profil Bisnis</Text>
          <TouchableOpacity style={styles.avatarPicker} onPress={() => pickImage('profile')} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#00AA13" />
            ) : photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <FontAwesome5 name="camera" size={20} color="#64748b" />
                <Text style={styles.avatarText}>Pilih Foto</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biodata Dasar</Text>
          <CustomInput 
            label="Nama Lengkap / Bisnis" 
            value={name} 
            onChangeText={setName} 
            placeholder="Masukkan nama lengkap" 
          />
          <CustomInput 
            label="Nomor WhatsApp" 
            value={whatsapp} 
            onChangeText={setWhatsapp} 
            placeholder="Contoh: 08123456789" 
            keyboardType="phone-pad"
          />
          <CustomInput 
            label="Bio / Deskripsi Bisnis" 
            value={bio} 
            onChangeText={setBio} 
            placeholder="Tulis sedikit tentang bisnis kost Anda..." 
            multiline
          />
        </View>

        <View style={styles.section}>
          <View style={styles.legalHeader}>
             <FontAwesome5 name="shield-alt" size={16} color="#00AA13" />
             <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8 }]}>Data Legalitas (Wajib)</Text>
          </View>
          <View style={styles.legalNotice}>
            <Text style={styles.legalNoticeText}>Data ini digunakan untuk verifikasi identitas dan keamanan pencairan dana sewa.</Text>
          </View>
          
          <CustomInput 
            label="Nomor NPWP" 
            value={npwp} 
            onChangeText={setNpwp} 
            placeholder="Contoh: 12.345.678.9-012.000" 
            keyboardType="numeric"
          />

          <CustomInput 
            label="Alamat Lengkap (Sesuai KTP)" 
            value={address} 
            onChangeText={setAddress} 
            placeholder="Jl. Merdeka No. 1, Kota..." 
            multiline
          />

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Foto KTP</Text>
          <TouchableOpacity style={styles.ktpPicker} onPress={() => pickImage('ktp')} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#00AA13" />
            ) : ktpURL ? (
              <View style={styles.imgWrapper}>
                <Image source={{ uri: ktpURL }} style={styles.ktpPreview} resizeMode="cover" />
                <View style={styles.changeBadge}>
                  <Text style={styles.changeText}>Ganti Foto</Text>
                </View>
              </View>
            ) : (
              <View style={styles.ktpPlaceholder}>
                <FontAwesome5 name="id-card" size={30} color="#64748b" />
                <Text style={styles.ktpText}>Upload Foto KTP</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Foto Selfie dengan KTP</Text>
          <TouchableOpacity style={styles.ktpPicker} onPress={() => pickImage('selfie')} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#00AA13" />
            ) : selfieKTPURL ? (
              <View style={styles.imgWrapper}>
                <Image source={{ uri: selfieKTPURL }} style={styles.ktpPreview} resizeMode="cover" />
                <View style={styles.changeBadge}>
                  <Text style={styles.changeText}>Ganti Foto</Text>
                </View>
              </View>
            ) : (
              <View style={styles.ktpPlaceholder}>
                <FontAwesome5 name="user-check" size={30} color="#64748b" />
                <Text style={styles.ktpText}>Upload Selfie + KTP</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Informasi Rekening Bank</Text>
          <CustomInput 
            label="Nama Bank" 
            value={bankName} 
            onChangeText={setBankName} 
            placeholder="Contoh: BCA, Mandiri, BNI..." 
          />
          <CustomInput 
            label="Nomor Rekening" 
            value={bankAccount} 
            onChangeText={setBankAccount} 
            placeholder="Contoh: 1234567890" 
            keyboardType="numeric"
          />
          <CustomInput 
            label="Atas Nama Rekening" 
            value={bankAccountName} 
            onChangeText={setBankAccountName} 
            placeholder="Harus sesuai dengan nama di KTP" 
          />
        </View>

        <CustomButton 
          title="Simpan Perubahan Legalitas" 
          onPress={handleSave} 
          loading={loading} 
        />
      </ScrollView>

      <CustomAlert 
        visible={alertVisible}
        title={alertData.title}
        message={alertData.message}
        type={alertData.type}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertData.onConfirm}
      />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: { padding: 8, marginRight: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },
  content: { padding: 24 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 12 },
  avatarPicker: { alignSelf: 'center', marginBottom: 10 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  ktpPicker: { width: '100%', height: 180, backgroundColor: '#f1f5f9', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  ktpPlaceholder: { alignItems: 'center' },
  ktpText: { fontSize: 14, color: '#64748b', marginTop: 8 },
  imgWrapper: { width: '100%', height: 180, position: 'relative' },
  ktpPreview: { width: '100%', height: 180, borderRadius: 14 },
  changeBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  changeText: { color: '#fff', fontSize: 12 },
  legalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  legalNotice: { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#DCFCE7' },
  legalNoticeText: { fontSize: 12, color: '#166534', lineHeight: 18 },
});
