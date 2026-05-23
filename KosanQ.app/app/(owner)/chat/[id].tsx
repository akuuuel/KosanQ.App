import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Image,
  Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { 
  sendMessage, 
  listenMessages, 
  markMessagesAsRead, 
  setTypingStatus,
  markMessagesAsDelivered
} from '../../../src/services/chatService';
import { Message, UserProfile } from '../../../src/types';
import { db } from '../../../src/services/firebase';
import { onSnapshot, doc } from 'firebase/firestore';
import { getUserProfile } from '../../../src/services/userService';

export default function OwnerChatDetailScreen() {
  const { id, name, role } = useLocalSearchParams();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  // Detect if this is an admin broadcast conversation (read-only)
  const isAdminChat = otherProfile?.role === 'admin' || String(role) === 'admin';

  useEffect(() => {
    if (typeof id === 'string') {
      fetchOtherProfile();
    }
  }, [id]);

  const fetchOtherProfile = async () => {
    const p = await getUserProfile(id as string);
    setOtherProfile(p);
  };

  useEffect(() => {
    if (profile?.uid && typeof id === 'string') {
      // Mark as delivered when receiving
      markMessagesAsDelivered(profile.uid);
      // Mark as read when opening
      markMessagesAsRead(profile.uid, id);

      const unsubscribe = listenMessages(profile.uid, id, (data) => {
        setMessages(data);
        setLoading(false);
        markMessagesAsRead(profile.uid, id);
      });

      // Listen for typing status
      const convId = [profile.uid, id].sort().join('_');
      const unsubTyping = onSnapshot(doc(db, 'conversations', convId), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setIsOtherTyping(data.typing?.[id] || false);
        }
      });

      return () => {
        unsubscribe();
        unsubTyping();
      };
    }
  }, [profile?.uid, id]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!profile?.uid || !id) return;

    // Set typing status
    setTypingStatus(profile.uid, id as string, true);

    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Set timeout to stop typing status
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(profile.uid, id as string, false);
    }, 2000);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !profile || !id) return;
    const text = inputText.trim();
    setInputText('');
    try {
      await sendMessage(profile.uid, id as string, text);
    } catch (error) {
      console.error(error);
    }
  };

  const renderTicks = (status: string) => {
    if (status === 'read') return <FontAwesome5 name="check-double" size={10} color="#3b82f6" />;
    if (status === 'delivered') return <FontAwesome5 name="check-double" size={10} color="rgba(255,255,255,0.7)" />;
    return <FontAwesome5 name="check" size={10} color="rgba(255,255,255,0.7)" />;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === profile?.uid;
    return (
      <View style={[
        styles.messageContainer, 
        isMine ? styles.myMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.bubble, 
          isMine ? styles.myBubble : styles.otherBubble
        ]}>
          <Text style={[
            styles.messageText, 
            isMine ? styles.myText : styles.otherText
          ]}>
            {item.text}
          </Text>
          <View style={styles.timeRow}>
            <Text style={[
              styles.timeText, 
              isMine ? styles.myTime : styles.otherTime
            ]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMine && (
              <View style={styles.statusIcon}>
                {renderTicks(item.status)}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const ProfileModal = () => (
    <Modal
      visible={showProfileModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowProfileModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={() => setShowProfileModal(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalAvatarContainer}>
            {otherProfile?.photoURL ? (
              <Image source={{ uri: otherProfile.photoURL }} style={styles.modalAvatar} />
            ) : (
              <View style={[styles.modalAvatar, { backgroundColor: '#00AA13', justifyContent: 'center', alignItems: 'center' }]}>
                <FontAwesome5 name="user" size={40} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.modalName}>{otherProfile?.name || name || 'User'}</Text>
          <Text style={styles.modalRole}>
            {(otherProfile?.role || role) === 'owner' ? 'Pemilik Kost' : 'Pencari Kost'}
          </Text>
          <View style={styles.modalBioContainer}>
            <Text style={styles.modalBioLabel}>Tentang</Text>
            <Text style={styles.modalBioText}>
              {otherProfile?.bio || 'Tidak ada bio tersedia.'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.closeBtn} 
            onPress={() => setShowProfileModal(false)}
          >
            <Text style={styles.closeBtnText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#1C1C1C" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.headerInfo} 
          onPress={() => setShowProfileModal(true)}
        >
          <View style={[styles.avatar, isAdminChat && styles.adminAvatar]}>
            {isAdminChat ? (
              <FontAwesome5 name="shield-alt" size={14} color="#fff" />
            ) : otherProfile?.photoURL ? (
              <Image source={{ uri: otherProfile.photoURL }} style={styles.avatarImg} />
            ) : (
              <FontAwesome5 name="user" size={14} color="#fff" />
            )}
          </View>
          <View>
            <Text style={styles.headerName}>{otherProfile?.name || name || 'Admin KosanQ'}</Text>
            {isOtherTyping ? (
              <Text style={styles.typingText}>sedang mengetik...</Text>
            ) : (
              <Text style={styles.headerRole}>
                {isAdminChat ? '📣 Pesan Resmi — Hanya Baca' : (otherProfile?.role || role) === 'owner' ? 'Pemilik Kost' : 'Pencari Kost'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00AA13" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          inverted
        />
      )}

      {isAdminChat ? (
        <View style={styles.readOnlyBar}>
          <FontAwesome5 name="lock" size={14} color="#64748b" />
          <Text style={styles.readOnlyText}>Pesan dari Admin tidak dapat dibalas</Text>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Balas pesan..."
            value={inputText}
            onChangeText={handleInputChange}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <FontAwesome5 name="paper-plane" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <ProfileModal />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 2,
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00AA13',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  headerName: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  headerRole: { fontSize: 11, color: '#94a3b8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: 16, paddingBottom: 20 },
  messageContainer: { marginBottom: 16, flexDirection: 'row' },
  myMessage: { justifyContent: 'flex-end' },
  otherMessage: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 1,
  },
  myBubble: { backgroundColor: '#00AA13', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15 },
  myText: { color: '#fff' },
  otherText: { color: '#1C1C1C' },
  timeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4, gap: 4 },
  statusIcon: { marginLeft: 2 },
  timeText: { fontSize: 10 },
  myTime: { color: 'rgba(255,255,255,0.7)' },
  otherTime: { color: '#94a3b8' },
  typingText: { fontSize: 11, color: '#00AA13', fontWeight: 'bold' },
  inputBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    color: '#1C1C1C',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00AA13',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
  adminAvatar: { backgroundColor: '#F97316' },
  readOnlyBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  readOnlyText: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    padding: 24,
    alignItems: 'center',
  },
  modalAvatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#00AA13',
  },
  modalAvatar: { width: '100%', height: '100%' },
  modalName: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  modalRole: { fontSize: 14, color: '#00AA13', fontWeight: '600', marginTop: 4 },
  modalBioContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginTop: 20,
  },
  modalBioLabel: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
  modalBioText: { fontSize: 15, color: '#4A4A4A', lineHeight: 22 },
  closeBtn: {
    marginTop: 24,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 12,
  },
  closeBtnText: { color: '#64748b', fontWeight: 'bold' }
});
