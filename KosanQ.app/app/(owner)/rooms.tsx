import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getKostsByOwner } from '../../src/services/kostService';
import { addRoom, listenRooms, updateRoom, deleteRoom } from '../../src/services/roomService';
import { Room, Kost } from '../../src/types';
import { CustomInput } from '../../src/components/CustomInput';
import { CustomButton } from '../../src/components/CustomButton';
import * as ImagePicker from 'expo-image-picker';
import { compressAndResizeImage, uploadImage } from '../../src/services/storageService';
import { Image, ScrollView as ScrollViewNative } from 'react-native';

export default function RoomManagementScreen() {
  const { profile } = useAuth();
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [selectedKost, setSelectedKost] = useState<Kost | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form state
  const [roomNumber, setRoomNumber] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [facilities, setFacilities] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState<'available' | 'occupied'>('available');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile?.uid) {
      fetchKosts();
    }
  }, [profile?.uid]);

  const fetchKosts = async () => {
    const data = await getKostsByOwner(profile!.uid);
    setKosts(data);
    if (data.length > 0) {
      setSelectedKost(data[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedKost) {
      const unsubscribe = listenRooms(selectedKost.id, (data) => {
        setRooms(data.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)));
      });
      return () => unsubscribe();
    }
  }, [selectedKost]);

  const handleSave = async () => {
    if (!selectedKost) {
      Alert.alert('Peringatan', 'Anda harus memiliki Kost terlebih dahulu sebelum menambah kamar.');
      return;
    }
    if (!roomNumber || !price) {
      Alert.alert('Peringatan', 'Nomor kamar dan harga wajib diisi.');
      return;
    }
    
    setLoading(true);
    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, {
          roomNumber,
          price: parseInt(price),
          description,
          facilities: facilities.split(',').map(f => f.trim()).filter(f => f !== ''),
          images,
          status,
        });
      } else {
        await addRoom({
          kostId: selectedKost.id,
          roomNumber,
          price: parseInt(price),
          status: 'available',
          description,
          facilities: facilities.split(',').map(f => f.trim()).filter(f => f !== ''),
          images,
        });
      }
      setModalVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Gagal menyimpan data kamar');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Hapus Kamar',
      'Apakah Anda yakin ingin menghapus kamar ini?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => deleteRoom(id) }
      ]
    );
  };

  const resetForm = () => {
    setRoomNumber('');
    setPrice('');
    setDescription('');
    setFacilities('');
    setImages([]);
    setStatus('available');
    setEditingRoom(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        const newImages = [...images];
        for (const asset of result.assets) {
          const compressed = await compressAndResizeImage(asset.uri);
          const url = await uploadImage(compressed, 'rooms');
          newImages.push(url);
        }
        setImages(newImages);
      } catch (error) {
        Alert.alert('Error', 'Gagal mengunggah gambar');
      } finally {
        setUploading(false);
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setRoomNumber(room.roomNumber);
    setPrice(room.price.toString());
    setDescription(room.description || '');
    setFacilities(room.facilities?.join(', ') || '');
    setImages(room.images || []);
    setStatus(room.status);
    setModalVisible(true);
  };

  const renderRoom = ({ item }: { item: Room }) => (
    <View style={styles.roomCard}>
      <View style={styles.roomInfo}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomNumber}>Kamar {item.roomNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'available' ? '#E6F6E8' : '#FEF2F2' }]}>
            <Text style={[styles.statusText, { color: item.status === 'available' ? '#00AA13' : '#EF4444' }]}>
              {item.status === 'available' ? 'Kosong' : 'Terisi'}
            </Text>
          </View>
        </View>
        <Text style={styles.roomPrice}>Rp {item.price.toLocaleString('id-ID')} / bulan</Text>
      </View>
      <View style={styles.roomActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
          <FontAwesome5 name="edit" size={16} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
          <FontAwesome5 name="trash" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manajemen Kamar</Text>
        <Text style={styles.subtitle}>Kelola inventaris kamar kost Anda</Text>
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
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="door-closed" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>Belum ada kamar</Text>
            <Text style={styles.emptySubtext}>Klik tombol + untuk menambah kamar baru</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setModalVisible(true); }}>
        <FontAwesome5 name="plus" size={20} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingRoom ? 'Edit Kamar' : 'Tambah Kamar Baru'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollViewNative showsVerticalScrollIndicator={false}>
              <CustomInput 
                label="Nomor Kamar" 
                placeholder="Contoh: A1 atau 101" 
                value={roomNumber} 
                onChangeText={setRoomNumber} 
              />
              <CustomInput 
                label="Harga per Bulan" 
                placeholder="Masukkan nominal harga" 
                value={price} 
                onChangeText={setPrice} 
                keyboardType="numeric"
              />

              {editingRoom && (
                <View style={styles.statusSection}>
                  <Text style={styles.inputLabel}>Status Kamar</Text>
                  <View style={styles.statusRow}>
                    <TouchableOpacity 
                      style={[styles.statusChip, status === 'available' && styles.statusChipActive]} 
                      onPress={() => setStatus('available')}
                    >
                      <Text style={[styles.statusChipText, status === 'available' && styles.statusChipTextActive]}>Tersedia</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.statusChip, status === 'occupied' && styles.statusChipActiveOccupied]} 
                      onPress={() => setStatus('occupied')}
                    >
                      <Text style={[styles.statusChipText, status === 'occupied' && styles.statusChipTextActive]}>Terisi</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <CustomInput 
                label="Deskripsi Kamar" 
                placeholder="Misal: Kamar dengan pemandangan taman..." 
                value={description} 
                onChangeText={setDescription} 
                multiline
              />

              <CustomInput 
                label="Fasilitas (Pisahkan dengan koma)" 
                placeholder="Misal: AC, Wifi, Kasur, Kamar Mandi Dalam" 
                value={facilities} 
                onChangeText={setFacilities} 
              />

              <View style={styles.imageSection}>
                <View style={styles.imageHeader}>
                  <Text style={styles.inputLabel}>Foto Kamar</Text>
                  <TouchableOpacity style={styles.addImgBtn} onPress={pickImage} disabled={uploading}>
                    <FontAwesome5 name="plus" size={12} color="#00AA13" />
                    <Text style={styles.addImgText}>Tambah</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.imageList}>
                  {images.map((img, idx) => (
                    <View key={idx} style={styles.imageItem}>
                      <Image source={{ uri: img }} style={styles.imagePreview} />
                      <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(idx)}>
                        <FontAwesome5 name="times" size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {uploading && (
                    <View style={styles.uploadingItem}>
                      <ActivityIndicator color="#00AA13" />
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.modalActions}>
                <CustomButton 
                  title="Simpan Perubahan" 
                  onPress={handleSave} 
                  loading={loading}
                />
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Batal</Text>
                </TouchableOpacity>
              </View>
            </ScrollViewNative>
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
  roomCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  roomInfo: { flex: 1 },
  roomHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 10 },
  roomNumber: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  roomPrice: { fontSize: 14, color: '#64748b' },
  roomActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { padding: 8 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 10 },
  statusSection: { marginBottom: 20 },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  statusChipActive: { backgroundColor: '#E6F6E8', borderWidth: 1, borderColor: '#00AA13' },
  statusChipActiveOccupied: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#EF4444' },
  statusChipText: { fontSize: 13, color: '#64748b' },
  statusChipTextActive: { fontWeight: 'bold' },
  imageSection: { marginBottom: 20 },
  imageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addImgBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E6F6E8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addImgText: { fontSize: 12, color: '#00AA13', fontWeight: 'bold' },
  imageList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageItem: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  removeImgBtn: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(239, 68, 68, 0.8)', justifyContent: 'center', alignItems: 'center' },
  uploadingItem: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  modalActions: { marginTop: 20, gap: 10 },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 8 }
});
