import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
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
import { Image, ActivityIndicator } from 'react-native';

export default function EditProfileScreen() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [ktpURL, setKtpURL] = useState(profile?.ktpURL || '');
  
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

  const pickImage = async (type: 'profile' | 'ktp') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: type === 'profile',
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        const compressedBase64 = await compressAndResizeImage(result.assets[0].uri);
        const url = await uploadImage(compressedBase64, type === 'profile' ? 'avatars' : 'ktp');
        if (type === 'profile') setPhotoURL(url);
        else setKtpURL(url);
      } catch (error) {
        showAlert('Error', 'Gagal mengunggah gambar. Silakan coba lagi.', 'error');
      } finally {
        setUploading(false);
      }
    }
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
      }, { merge: true });
      
      showAlert('Sukses!', 'Profil Anda berhasil diperbarui.', 'success', () => {
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foto Profil</Text>
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
          <CustomInput 
            label="Nama Lengkap" 
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
            label="Bio / Info" 
            value={bio} 
            onChangeText={setBio} 
            placeholder="Tulis sedikit tentang dirimu..." 
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foto KTP (Wajib untuk Sewa)</Text>
          <TouchableOpacity style={styles.ktpPicker} onPress={() => pickImage('ktp')} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#00AA13" />
            ) : ktpURL ? (
              <View>
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
        </View>

        <CustomButton 
          title="Simpan Perubahan" 
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
  ktpPreview: { width: '100%', height: '100%' },
  changeBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  changeText: { color: '#fff', fontSize: 12 },
});
