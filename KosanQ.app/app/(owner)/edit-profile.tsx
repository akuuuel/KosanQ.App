import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Image, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { CustomInput } from '../../src/components/CustomInput';
import { CustomButton } from '../../src/components/CustomButton';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage } from '../../src/services/storageService';

export default function OwnerEditProfileScreen() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        const compressedBase64 = await compressAndResizeImage(result.assets[0].uri);
        const url = await uploadImage(compressedBase64, 'avatars');
        setPhotoURL(url);
      } catch (error) {
        Alert.alert('Error', 'Gagal mengunggah gambar. Silakan coba lagi.');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Nama wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', profile!.uid);
      await setDoc(userRef, {
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        photoURL,
        updatedAt: Date.now()
      }, { merge: true });
      
      Alert.alert('Sukses', 'Profil berhasil diperbarui.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memperbarui profil.');
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
        <Text style={styles.title}>Edit Profil Owner</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foto Profil Bisnis</Text>
          <TouchableOpacity style={styles.avatarPicker} onPress={pickImage} disabled={uploading}>
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
            label="Nama Lengkap / Bisnis" 
            value={name} 
            onChangeText={setName} 
            placeholder="Masukkan nama Anda atau brand kost" 
          />
          <CustomInput 
            label="Nomor WhatsApp Bisnis" 
            value={whatsapp} 
            onChangeText={setWhatsapp} 
            placeholder="Contoh: 08123456789" 
            keyboardType="phone-pad"
          />
          <Text style={styles.infoText}>Nomor WhatsApp ini akan digunakan penyewa untuk menghubungi Anda.</Text>
        </View>

        <CustomButton 
          title="Simpan Perubahan" 
          onPress={handleSave} 
          loading={loading} 
        />
      </ScrollView>
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
  infoText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: -8, marginBottom: 10 },
});
