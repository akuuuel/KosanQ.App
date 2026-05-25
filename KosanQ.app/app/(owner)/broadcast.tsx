import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { createBroadcast } from '../../src/services/broadcastService';
import { getApprovedOwnerKosts } from '../../src/services/kostService';
import { Kost } from '../../src/types';
import { CustomButton } from '../../src/components/CustomButton';

export default function OwnerBroadcastScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [selectedKostId, setSelectedKostId] = useState<string>('');

  React.useEffect(() => {
    if (profile?.uid) {
      fetchKosts();
    }
  }, [profile?.uid]);

  const fetchKosts = async () => {
    try {
      const data = await getApprovedOwnerKosts(profile!.uid);
      setKosts(data);
      if (data.length > 0) {
        setSelectedKostId(data[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Peringatan', 'Judul dan isi pengumuman tidak boleh kosong.');
      return;
    }

    if (!selectedKostId) {
      Alert.alert('Peringatan', 'Pilih kost tujuan pengumuman.');
      return;
    }

    setLoading(true);
    try {
      await createBroadcast({
        kostId: selectedKostId,
        title: title.trim(),
        message: message.trim(),
        author: profile?.name || 'Pemilik Kost',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Default 24h
        createdAt: Date.now()
      });
      
      Alert.alert('Sukses', 'Pengumuman berhasil disebarkan ke seluruh penghuni.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengirim pengumuman. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome5 name="arrow-left" size={20} color="#1C1C1C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Buat Pengumuman</Text>
        </View>

        <View style={styles.infoCard}>
          <FontAwesome5 name="info-circle" size={18} color="#3b82f6" />
          <Text style={styles.infoText}>
            Pengumuman ini akan muncul di halaman "Kamar Saya" milik seluruh penghuni selama 24 jam.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Pilih Kost Tujuan</Text>
          <View style={styles.kostSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {kosts.map((k) => (
                <TouchableOpacity 
                  key={k.id} 
                  style={[styles.kostChip, selectedKostId === k.id && styles.kostChipActive]}
                  onPress={() => setSelectedKostId(k.id)}
                >
                  <Text style={[styles.kostChipText, selectedKostId === k.id && styles.kostChipTextActive]}>
                    {k.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.label}>Judul Pengumuman</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Info Pembayaran Listrik"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />

          <Text style={styles.label}>Isi Pengumuman</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tuliskan pesan yang ingin Anda sampaikan secara detail..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Pratinjau Pesan:</Text>
            <View style={styles.notifCard}>
              <View style={styles.notifHeader}>
                <Text style={styles.notifTitle}>{title || 'Judul Pengumuman'}</Text>
                <Text style={styles.notifTime}>Baru</Text>
              </View>
              <Text style={styles.notifMsg}>{message || 'Pesan Anda akan muncul di sini...'}</Text>
              <Text style={styles.notifAuthor}>Oleh: {profile?.name || 'Pemilik Kost'}</Text>
            </View>
          </View>

          <CustomButton 
            title="Sebarkan Sekarang" 
            onPress={handleSend} 
            loading={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: { padding: 8, marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1C' },
  infoCard: { flexDirection: 'row', backgroundColor: '#E0F2FE', padding: 16, borderRadius: 16, gap: 12, alignItems: 'center', marginBottom: 24 },
  infoText: { flex: 1, fontSize: 13, color: '#0369A1', lineHeight: 20 },
  form: { gap: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: -12 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 15, color: '#1C1C1C', borderWidth: 1, borderColor: '#E2E8F0' },
  textArea: { minHeight: 120 },
  previewCard: { marginTop: 10, marginBottom: 10 },
  previewTitle: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8', marginBottom: 12 },
  notifCard: { backgroundColor: '#fff', borderRadius: 15, padding: 16, borderLeftWidth: 4, borderLeftColor: '#00AA13', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notifTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  notifTime: { fontSize: 10, color: '#00AA13', fontWeight: 'bold' },
  notifMsg: { fontSize: 14, color: '#4A4A4A', lineHeight: 20 },
  notifAuthor: { fontSize: 11, color: '#94a3b8', marginTop: 10, fontStyle: 'italic' },
  kostSelector: { marginBottom: 10 },
  kostChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  kostChipActive: { backgroundColor: '#E6F6E8', borderColor: '#00AA13' },
  kostChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  kostChipTextActive: { color: '#00AA13' }
});
