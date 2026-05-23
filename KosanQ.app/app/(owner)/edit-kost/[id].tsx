import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getKostById, updateKost } from '../../../src/services/kostService';
import { Kost } from '../../../src/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { CustomInput } from '../../../src/components/CustomInput';
import { CustomButton } from '../../../src/components/CustomButton';
import { CustomAlert } from '../../../src/components/CustomAlert';
import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage } from '../../../src/services/storageService';
import { MapPicker } from '../../../src/components/MapPicker';

export default function EditKostScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [kost, setKost] = useState<Kost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  useEffect(() => {
    fetchKost();
  }, [id]);

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const fetchKost = async () => {
    try {
      const data = await getKostById(id as string);
      if (data) {
        setKost(data);
        setName(data.name);
        setPrice(data.price.toString());
        setLocation(data.location);
        setDescription(data.description);
        setImages(data.images);
        if (data.latitude && data.longitude) {
          setCoords({ latitude: data.latitude, longitude: data.longitude });
        }
      }
    } catch (error) {
      showAlert('Error', 'Gagal memuat data kost', 'error');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setSaving(true);
      try {
        const uris = result.assets.map(asset => asset.uri);
        const uploadedUrls = [];
        for (const uri of uris) {
          const compressedBase64 = await compressAndResizeImage(uri);
          const url = await uploadImage(compressedBase64, 'kosts');
          uploadedUrls.push(url);
        }
        setImages([...images, ...uploadedUrls]);
      } catch (error) {
        showAlert('Gagal', 'Gagal mengunggah gambar', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!name || !price || !location) {
      showAlert('Data Belum Lengkap', 'Harap isi field wajib', 'warning');
      return;
    }

    setSaving(true);
    try {
      await updateKost(id as string, {
        name,
        price: parseInt(price),
        location,
        description,
        images,
        status: 'approved',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      setIsEditing(false);
      fetchKost();
      showAlert('Berhasil!', 'Perubahan berhasil disimpan.', 'success');
    } catch (error) {
      showAlert('Error', 'Gagal memperbarui data kost', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00AA13" />
      </View>
    );
  }

  if (!kost) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Kost' : 'Detail Kost'}</Text>
        <TouchableOpacity 
          onPress={() => setIsEditing(!isEditing)} 
          style={styles.editToggle}
        >
          <FontAwesome5 name={isEditing ? "times" : "edit"} size={18} color="#00AA13" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner Status */}
        {kost.status === 'pending' && (
          <View style={styles.statusBanner}>
            <FontAwesome5 name="clock" size={14} color="#F59E0B" />
            <Text style={styles.statusText}>Menunggu persetujuan admin. Perubahan mungkin belum tampil bagi publik.</Text>
          </View>
        )}

        {/* Image Slider Placeholder */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageSection}>
          {images.map((uri, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri }} style={styles.heroImage} />
              {isEditing && (
                <TouchableOpacity 
                  style={styles.removeImgBtn}
                  onPress={() => setImages(images.filter((_, i) => i !== index))}
                >
                  <FontAwesome5 name="times-circle" size={18} color="#EE2737" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {isEditing && (
            <TouchableOpacity style={styles.addImgBtn} onPress={pickImage}>
              <FontAwesome5 name="plus" size={24} color="#00AA13" />
              <Text style={styles.addImgText}>Tambah</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.content}>
          {isEditing ? (
            <View style={styles.form}>
              <CustomInput label="Nama Kost" value={name} onChangeText={setName} />
              <CustomInput label="Harga per Bulan" value={price} onChangeText={setPrice} keyboardType="numeric" />
              <CustomInput label="Lokasi" value={location} onChangeText={setLocation} />
              
              <Text style={styles.sectionTitle}>Titik Lokasi Peta</Text>
              <MapPicker 
                initialLocation={coords || undefined} 
                onLocationSelect={setCoords} 
              />
              {coords && (
                <View style={styles.coordsBadge}>
                  <FontAwesome5 name="check-circle" size={12} color="#00AA13" />
                  <Text style={styles.coordsText}>Lokasi terpilih: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
                </View>
              )}

              <CustomInput 
                label="Deskripsi" 
                value={description} 
                onChangeText={setDescription} 
                placeholder="Fasilitas, aturan, dll..."
                multiline
              />
              <CustomButton title="Simpan Perubahan" onPress={handleSave} loading={saving} />
            </View>
          ) : (
            <View style={styles.details}>
              <View style={styles.priceSection}>
                <Text style={styles.priceLabel}>Harga Sewa</Text>
                <Text style={styles.priceValue}>Rp {kost.price.toLocaleString('id-ID')} <Text style={styles.priceUnit}>/ bulan</Text></Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>{kost.name}</Text>
                <View style={styles.locationRow}>
                  <FontAwesome5 name="map-marker-alt" size={14} color="#64748b" />
                  <Text style={styles.locationText}>{kost.location}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.descSection}>
                <Text style={styles.sectionTitle}>Deskripsi</Text>
                <Text style={styles.descText}>{kost.description || 'Tidak ada deskripsi.'}</Text>
              </View>

              <View style={styles.divider} />
              
              <View style={styles.statusSection}>
                <Text style={styles.sectionTitle}>Status Kost</Text>
                <View style={[
                  styles.statusBadge, 
                  { backgroundColor: kost.status === 'approved' ? '#E6F6E8' : '#FEF3C7' }
                ]}>
                  <Text style={[
                    styles.statusBadgeText, 
                    { color: kost.status === 'approved' ? '#00AA13' : '#D97706' }
                  ]}>
                    {kost.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          )}
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
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },
  editToggle: { padding: 8 },
  statusBanner: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
  },
  statusText: { fontSize: 12, color: '#D97706', flex: 1 },
  imageSection: { padding: 20 },
  imageWrapper: { position: 'relative', marginRight: 15 },
  heroImage: { width: 300, height: 200, borderRadius: 20 },
  removeImgBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addImgBtn: {
    width: 150,
    height: 200,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00AA13',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E6F6E8',
  },
  addImgText: { fontSize: 14, color: '#00AA13', fontWeight: 'bold', marginTop: 8 },
  content: { padding: 20 },
  form: { gap: 10 },
  details: { gap: 20 },
  priceSection: {
    backgroundColor: '#E6F6E8',
    padding: 16,
    borderRadius: 16,
  },
  priceLabel: { fontSize: 12, color: '#00AA13', fontWeight: 'bold', textTransform: 'uppercase' },
  priceValue: { fontSize: 24, fontWeight: 'bold', color: '#00AA13', marginTop: 4 },
  priceUnit: { fontSize: 14, fontWeight: 'normal', color: '#00AA13' },
  infoSection: {},
  infoTitle: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationText: { fontSize: 14, color: '#64748b' },
  divider: { height: 1, backgroundColor: '#f1f5f9' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 12 },
  descSection: {},
  descText: { fontSize: 15, color: '#4A4A4A', lineHeight: 24 },
  statusSection: {},
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 12, fontWeight: 'bold' },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F6E8',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  coordsText: {
    fontSize: 12,
    color: '#00AA13',
    fontWeight: 'bold',
  },
});
