import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { getConversations, deleteConversationForUser } from '../../../src/services/chatService';
import { Conversation } from '../../../src/types';
import { useRouter } from 'expo-router';
import { CustomAlert } from '../../../src/components/CustomAlert';

export default function UserChatScreen() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  useEffect(() => {
    if (profile?.uid) {
      const unsubscribe = getConversations(profile.uid, (data) => {
        setConversations(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [profile?.uid]);

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const handleDelete = (id: string) => {
    showAlert(
      'Hapus Chat',
      'Apakah Anda yakin ingin menghapus seluruh percakapan ini?',
      'warning',
      async () => {
        setAlertVisible(false);
        try {
          if (profile?.uid) {
            await deleteConversationForUser(id, profile.uid);
          }
        } catch (error) {
          showAlert('Error', 'Gagal menghapus percakapan', 'error');
        }
      }
    );
  };

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push({
        pathname: '/(user)/chat/[id]',
        params: { id: item.otherUserId, name: item.otherUserName, role: item.otherUserRole }
      })}
      onLongPress={() => handleDelete(item.id)}
    >
      <View style={styles.avatar}>
        {item.otherUserPhoto ? (
          <Image source={{ uri: item.otherUserPhoto }} style={styles.avatarImg} />
        ) : (
          <FontAwesome5 name="user" size={20} color="#fff" />
        )}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.userName}>{item.otherUserName || 'User'}</Text>
            <Text style={styles.userRole}>{item.otherUserRole === 'owner' ? 'Pemilik Kost' : 'Pencari Kost'}</Text>
          </View>
          <Text style={styles.time}>
            {new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.lastMessageRow}>
          <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
        <Text style={styles.headerSubtitle}>Hubungi pemilik kost langsung</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00AA13" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <FontAwesome5 name="comments" size={40} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyText}>Belum Ada Pesan</Text>
              <Text style={styles.emptySubtext}>Tanya-tanya soal kost yang kamu suka di sini.</Text>
            </View>
          }
        />
      )}

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
    backgroundColor: '#00AA13',
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00AA13',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  cardContent: { flex: 1, marginLeft: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  userRole: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  time: { fontSize: 12, color: '#94a3b8' },
  lastMessageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#64748b', flex: 1 },
  lastMessageUnread: { color: '#1C1C1C', fontWeight: '600' },
  unreadBadge: {
    backgroundColor: '#00AA13',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 8, paddingHorizontal: 40 }
});
