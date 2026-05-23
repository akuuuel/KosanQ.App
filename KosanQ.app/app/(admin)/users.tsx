import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Image, TextInput } from 'react-native';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { UserProfile } from '../../src/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { CustomAlert } from '../../src/components/CustomAlert';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'user' | 'owner'>('user');

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  useEffect(() => {
    fetchUsers();
  }, []);

  // Update filter whenever users, search, or activeTab changes
  useEffect(() => {
    applyFilters();
  }, [users, search, activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = users.filter(u => (u.role || 'user') === activeTab);
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(u => 
        (u.name?.toLowerCase() || '').includes(lowerSearch) || 
        (u.email?.toLowerCase() || '').includes(lowerSearch)
      );
    }
    
    setFilteredUsers(result);
  };

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const toggleVerification = async (user: UserProfile) => {
    const newValue = !user.isVerified;
    try {
      await updateDoc(doc(db, 'users', user.uid), { isVerified: newValue });
      
      // Update local state instead of refetching everything for better UX
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, isVerified: newValue } : u));
      showAlert('Sukses', `Status verifikasi ${user.name} diperbarui`, 'success');
    } catch (error) {
      showAlert('Error', 'Gagal memperbarui status', 'error');
    }
  };

  const renderItem = ({ item }: { item: UserProfile }) => (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: activeTab === 'owner' ? '#ec4899' : '#00AA13' }]}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatarImg} />
        ) : (
          <FontAwesome5 name={activeTab === 'owner' ? 'user-tie' : 'user'} size={18} color="#fff" />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name || 'No Name'}</Text>
        <Text style={styles.email}>{item.email || 'No Email'}</Text>
        <View style={styles.badgeRow}>
          {item.isVerified && (
            <View style={styles.verifiedBadge}>
              <FontAwesome5 name="check-circle" size={12} color="#00AA13" />
              <Text style={styles.verifiedText}>Terverifikasi</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity 
        style={[styles.verifyBtn, item.isVerified ? styles.unverifyBtn : (activeTab === 'owner' ? styles.verifyBtnOwner : styles.verifyBtnUser)]} 
        onPress={() => toggleVerification(item)}
      >
        <FontAwesome5 name={item.isVerified ? "user-slash" : "user-check"} size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        <Text style={styles.title}>Manajemen Pengguna</Text>
        <View style={styles.searchBar}>
          <FontAwesome5 name="search" size={14} color="#94a3b8" />
          <TextInput 
            style={styles.searchInput}
            placeholder={`Cari ${activeTab === 'user' ? 'pengguna' : 'pemilik'}...`}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'user' && styles.activeTabUser]}
          onPress={() => setActiveTab('user')}
        >
          <FontAwesome5 name="users" size={14} color={activeTab === 'user' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'user' && styles.activeTabText]}>Pencari Kost</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'owner' && styles.activeTabOwner]}
          onPress={() => setActiveTab('owner')}
        >
          <FontAwesome5 name="user-tie" size={14} color={activeTab === 'owner' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'owner' && styles.activeTabText]}>Pemilik Kost</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00AA13" />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="ghost" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>Tidak ada {activeTab === 'user' ? 'pengguna' : 'pemilik'}</Text>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#00AA13',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#1C1C1C' },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  activeTabUser: { backgroundColor: '#00AA13' },
  activeTabOwner: { backgroundColor: '#ec4899' },
  tabText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  activeTabText: { color: '#fff' },
  listContent: { padding: 20, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImg: { width: '100%', height: '100%' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: 'bold', color: '#1C1C1C' },
  email: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 10, color: '#00AA13', fontWeight: '600' },
  verifyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnUser: { backgroundColor: '#00AA13' },
  verifyBtnOwner: { backgroundColor: '#ec4899' },
  unverifyBtn: { backgroundColor: '#EE2737' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#64748b', fontSize: 14, marginTop: 12 }
});
