import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, ActivityIndicator
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, doc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../../src/services/firebase';
import { CustomButton } from '../../src/components/CustomButton';
import { CustomAlert } from '../../src/components/CustomAlert';

const ADMIN_PROFILE = {
  name: 'Admin KosanQ',
  photoURL: '',
  role: 'admin',
  bio: 'Tim Resmi KosanQ',
};

export default function AdminBroadcastPromoScreen() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const router = useRouter();

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const handleSendBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      showAlert('Peringatan', 'Harap isi judul dan isi pesan promo terlebih dahulu.', 'warning');
      return;
    }

    setLoading(true);
    const adminUid = auth.currentUser?.uid;
    if (!adminUid) return;

    try {
      // 1. Fetch all non-admin users
      const usersSnap = await getDocs(collection(db, 'users'));
      const targets = usersSnap.docs
        .map(d => ({ uid: d.id, ...d.data() as any }))
        .filter(u => u.role !== 'admin');

      setProgress(`Mengirim ke 0 / ${targets.length} pengguna...`);

      // 2. For each user, send a chat message as Admin
      let sent = 0;
      for (const target of targets) {
        const convId = [adminUid, target.uid].sort().join('_');
        const convRef = doc(db, 'conversations', convId);

        // Build the notification-style text
        const fullText = `📢 *${title.trim()}*\n\n${message.trim()}`;

        // Add message document
        await addDoc(collection(db, 'messages'), {
          conversationId: convId,
          senderId: adminUid,
          receiverId: target.uid,
          text: fullText,
          seen: false,
          isPromo: true,
          createdAt: Date.now(),
        });

        // Upsert conversation
        const convSnap = await getDoc(convRef);
        const existingProfiles = convSnap.exists() ? convSnap.data()?.profiles : null;

        await setDoc(convRef, {
          participants: [adminUid, target.uid],
          lastMessage: fullText,
          lastMessageAt: Date.now(),
          profiles: existingProfiles || {
            [adminUid]: ADMIN_PROFILE,
            [target.uid]: {
              name: target.name || 'Pengguna',
              photoURL: target.photoURL || '',
              role: target.role || 'user',
              bio: target.bio || '',
            },
          },
        }, { merge: true });

        sent++;
        setProgress(`Mengirim ke ${sent} / ${targets.length} pengguna...`);
      }

      showAlert(
        'Berhasil Dikirim! 🎉',
        `Promo "${title.trim()}" berhasil dikirim ke ${targets.length} pengguna melalui chat.`,
        'success',
        () => { setAlertVisible(false); router.back(); }
      );

      setTitle('');
      setMessage('');
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Terjadi kesalahan saat mengirim broadcast.', 'error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Broadcast Promo</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Preview Card */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionLabel}>Pratinjau di Chat</Text>
          <View style={styles.previewBubble}>
            <View style={styles.previewAvatar}>
              <FontAwesome5 name="shield-alt" size={16} color="#fff" />
            </View>
            <View style={styles.previewContent}>
              <Text style={styles.previewSender}>Admin KosanQ</Text>
              <View style={styles.promoBadge}>
                <FontAwesome5 name="bullhorn" size={10} color="#F97316" />
                <Text style={styles.promoBadgeText}>PROMO</Text>
              </View>
              <Text style={styles.previewTitle}>{title || 'Judul Promo...'}</Text>
              <Text style={styles.previewMsg} numberOfLines={3}>
                {message || 'Isi pesan promo akan muncul di sini...'}
              </Text>
            </View>
          </View>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBox}>
          <FontAwesome5 name="info-circle" size={14} color="#3b82f6" />
          <Text style={styles.infoText}>
            Pesan akan dikirim langsung ke tab <Text style={{ fontWeight: 'bold' }}>Chat</Text> semua Owner & User sebagai chat dari Admin KosanQ.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Judul Promo</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Diskon Spesial Hari Kemerdekaan"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Isi Pesan</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tuliskan detail promo, syarat & ketentuan, dll..."
            multiline
            numberOfLines={6}
            value={message}
            onChangeText={setMessage}
          />
        </View>

        {loading && progress ? (
          <View style={styles.progressBox}>
            <ActivityIndicator size="small" color="#00AA13" />
            <Text style={styles.progressText}>{progress}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 8 }}>
          <CustomButton
            title="Kirim ke Semua Pengguna"
            onPress={handleSendBroadcast}
            loading={loading}
          />
        </View>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  content: { padding: 20, paddingBottom: 40 },

  // Preview
  previewSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 12 },
  previewBubble: { backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', gap: 12, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  previewAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  previewContent: { flex: 1 },
  previewSender: { fontSize: 13, fontWeight: 'bold', color: '#00AA13', marginBottom: 4 },
  promoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 },
  promoBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#F97316' },
  previewTitle: { fontSize: 15, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 4 },
  previewMsg: { fontSize: 13, color: '#64748b', lineHeight: 18 },

  // Info box
  infoBox: { flexDirection: 'row', backgroundColor: '#EFF6FF', padding: 14, borderRadius: 14, gap: 10, marginBottom: 24, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, color: '#1e40af', lineHeight: 18 },

  // Form
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 14, padding: 16, fontSize: 15, color: '#1C1C1C', borderWidth: 1, borderColor: '#E2E8F0' },
  textArea: { height: 150, textAlignVertical: 'top' },

  // Progress
  progressBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDF4', padding: 14, borderRadius: 14, marginBottom: 16 },
  progressText: { color: '#166534', fontWeight: '600', fontSize: 13 },
});
