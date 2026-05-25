import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage, validateImage } from '../../src/services/storageService';
import { createKost } from '../../src/services/kostService';
import { useAuth } from '../../src/context/AuthContext';
import { CustomInput } from '../../src/components/CustomInput';
import { CustomButton } from '../../src/components/CustomButton';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { MapPicker } from '../../src/components/MapPicker';
import { validateRequiredFields, sanitizeText } from '../../src/utils/validation';
import * as Location from 'expo-location';
import { getKostById, updateKost } from '../../src/services/kostService';

export default function AddKostScreen() {
  const params = useLocalSearchParams();
  const kostId = params.id as string;
  const isEditing = !!kostId;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [type, setType] = useState<'putra' | 'putri' | 'campur'>('putra');
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  
  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  const { user, profile } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isEditing) {
      loadKostData();
    }
  }, [isEditing]);

  const loadKostData = async () => {
    setLoading(true);
    try {
      const kost = await getKostById(kostId);
      if (kost) {
        setName(kost.name);
        setPrice(kost.price.toString());
        setLocation(kost.location);
        setDescription(kost.description || '');
        setImages(kost.images || []);
        setType(kost.type as any || 'putra');
        if (kost.latitude && kost.longitude) {
          setCoords({ latitude: kost.latitude, longitude: kost.longitude });
        }
      }
    } catch (e) {
      showAlert('Error', 'Gagal memuat data kost untuk diedit', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      if (images.length + result.assets.length > 10) {
        showAlert('Peringatan', 'Maksimal 10 gambar yang diperbolehkan.', 'warning');
        return;
      }

      try {
        const uris = [];
        for (const asset of result.assets) {
          validateImage(asset.fileSize || 0, asset.mimeType || 'image/jpeg');
          uris.push(asset.uri);
        }
        setImages([...images, ...uris]);
      } catch (err: any) {
        showAlert('Gambar Tidak Valid', err.message, 'error');
      }
    }
  };

  const handleUpload = async () => {
    if (!profile) return;

    // Check if profile is complete with legal data
    const isProfileComplete = 
      profile.name && 
      profile.email && 
      profile.whatsapp && 
      profile.photoURL && 
      profile.bio && 
      profile.ktpURL &&
      profile.selfieKTPURL &&
      profile.npwp &&
      profile.address &&
      profile.bankName &&
      profile.bankAccount;

    if (!isProfileComplete) {
      showAlert(
        'Legalitas Belum Lengkap', 
        'Sebagai pemilik legal, Anda wajib melengkapi data NPWP, Selfie KTP, dan Rekening Bank sebelum mendaftarkan properti baru.', 
        'warning',
        () => {
          setAlertVisible(false);
          router.push('/(owner)/edit-profile');
        }
      );
      // Update data alert agar tombolnya lebih jelas
      setAlertData(prev => ({ ...prev, confirmText: 'Lengkapi Sekarang' }));
      return;
    }

    const validationError = validateRequiredFields({ Nama: name, Harga: price, Lokasi: location });
    if (validationError || images.length === 0) {
      showAlert('Data Belum Lengkap', validationError || 'Pilih minimal satu gambar', 'warning');
      return;
    }

    setLoading(true);
    try {
      const uploadedUrls = [];
      for (const uri of images) {
        // If the uri is already a firebase URL, skip compression and upload
        if (uri.startsWith('http')) {
          uploadedUrls.push(uri);
        } else {
          const compressedBase64 = await compressAndResizeImage(uri);
          const url = await uploadImage(compressedBase64, 'kosts');
          uploadedUrls.push(url);
        }
      }

      const kostData = {
        name: sanitizeText(name),
        price: parseInt(price),
        location: sanitizeText(location),
        description: sanitizeText(description),
        images: uploadedUrls,
        ownerId: user!.uid,
        type,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      };

      if (isEditing) {
        await updateKost(kostId, kostData);
        showAlert('Berhasil!', 'Data Kost Anda berhasil diperbarui.', 'success', () => {
          setAlertVisible(false);
          router.back();
        });
      } else {
        await createKost({
          ...kostData,
          status: 'pending' as any,
        });
        showAlert('Berhasil!', 'Kost Anda berhasil diajukan dan sedang menunggu verifikasi admin.', 'success', () => {
          setAlertVisible(false);
          router.back();
        });
      }
    } catch (error: any) {
      showAlert('Gagal', error.message || 'Terjadi kesalahan saat menyimpan kost. Silakan coba lagi.', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeocode = async () => {
    if (!location.trim()) {
      showAlert('Peringatan', 'Masukkan alamat terlebih dahulu untuk mencari di peta', 'warning');
      return;
    }
    setGeocoding(true);
    try {
      let results = await Location.geocodeAsync(location);
      
      // Jika pencarian bawaan HP gagal, gunakan pencarian cadangan (OpenStreetMap Nominatim)
      if (results.length === 0) {
        console.log('Menggunakan pencarian cadangan...');
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`);
        const json = await response.json();
        if (json && json.length > 0) {
          results = [{
            latitude: parseFloat(json[0].lat),
            longitude: parseFloat(json[0].lon)
          }] as any;
        }
      }

      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        setCoords({ latitude, longitude });
        showAlert('Lokasi Ditemukan', `Peta telah bergeser ke: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, 'success');
      } else {
        showAlert('Tidak Ditemukan', 'Alamat tidak ditemukan. Coba masukkan nama jalan atau kota yang lebih spesifik.', 'warning');
      }
    } catch (error) {
      showAlert('Error', 'Gagal memproses alamat. Periksa koneksi internet Anda.', 'error');
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Kost' : 'Tambah Kost Baru'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi Kost</Text>
          <CustomInput label="Nama Kost" value={name} onChangeText={setName} placeholder="Contoh: Kost Indah Melati" />
          <CustomInput label="Harga per Bulan" value={price} onChangeText={setPrice} placeholder="Contoh: 1500000" keyboardType="numeric" />
          <View style={styles.addressRow}>
            <View style={{ flex: 1 }}>
              <CustomInput label="Lokasi / Alamat" value={location} onChangeText={setLocation} placeholder="Alamat lengkap kost" />
            </View>
            <TouchableOpacity 
              style={[styles.geocodeBtn, geocoding && styles.disabledBtn]} 
              onPress={handleGeocode}
              disabled={geocoding}
            >
              {geocoding ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="search-location" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
          <CustomInput label="Deskripsi" value={description} onChangeText={setDescription} placeholder="Fasilitas, aturan, dll" multiline />
          
          <Text style={styles.labelSmall}>Tipe Kost</Text>
          <View style={styles.typeSelector}>
          {(['putra', 'putri', 'campur'] as const).map((t) => (
              <TouchableOpacity 
                key={t} 
                style={[styles.typeBtn, type === t && styles.typeBtnActive]} 
                onPress={() => setType(t)}
              >
                <FontAwesome5 
                  name={t === 'putra' ? 'mars' : t === 'putri' ? 'venus' : 'user-friends'} 
                  size={14} 
                  color={type === t ? '#fff' : '#64748b'} 
                />
                <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Titik Lokasi Peta</Text>
          <Text style={styles.sectionDesc}>Tentukan titik koordinat kost agar pencari mudah menemukan lokasi lewat navigasi.</Text>
          <MapPicker 
            onLocationSelect={setCoords} 
            initialLocation={coords || undefined} 
          />
          {coords && (
            <View style={styles.coordsBadge}>
              <FontAwesome5 name="check-circle" size={12} color="#00AA13" />
              <Text style={styles.coordsText}>Lokasi terpilih: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foto Kost</Text>
          <Text style={styles.sectionDesc}>Berikan foto terbaik agar calon penyewa tertarik.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity 
                  style={styles.removeBtn}
                  onPress={() => setImages(images.filter((_, i) => i !== index))}
                >
                  <FontAwesome5 name="times-circle" size={18} color="#EE2737" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addImgBtn} onPress={pickImage}>
              <FontAwesome5 name="camera" size={24} color="#00AA13" />
              <Text style={styles.addImgText}>Tambah</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <CustomButton title={isEditing ? 'Simpan Perubahan' : 'Daftarkan Kost'} onPress={handleUpload} loading={loading} />
        </View>
        
        <View style={{ height: 50 }} />
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F6E8',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  coordsText: {
    fontSize: 12,
    color: '#00AA13',
    fontWeight: 'bold',
  },
  imageScroll: {
    flexDirection: 'row',
    marginTop: 8,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  removeBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  addImgBtn: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00AA13',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E6F6E8',
  },
  addImgText: {
    fontSize: 12,
    color: '#00AA13',
    fontWeight: 'bold',
    marginTop: 6,
  },
  labelSmall: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 10, marginTop: 15 },
  typeSelector: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  typeBtnActive: { backgroundColor: '#00AA13', borderColor: '#00AA13' },
  typeText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  typeTextActive: { color: '#fff' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  geocodeBtn: { 
    backgroundColor: '#00AA13', 
    width: 50, 
    height: 50, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  disabledBtn: { opacity: 0.6 }
});
