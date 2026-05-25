import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Image, TextInput, Modal, ScrollView } from 'react-native';
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
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

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
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isVerified: newValue });
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, isVerified: newValue } : u));
      if (selectedUser?.uid === user.uid) setSelectedUser({ ...selectedUser, isVerified: newValue });
      showAlert('Sukses', `Status verifikasi ${user.name} diperbarui`, 'success');
    } catch (error) {
      showAlert('Error', 'Gagal memperbarui status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const changeRole = async (user: UserProfile, newRole: 'user' | 'owner' | 'admin') => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
      setDetailVisible(false);
      showAlert('Sukses', `Role ${user.name} diubah menjadi ${newRole}`, 'success');
    } catch (error) {
      showAlert('Error', 'Gagal mengubah role', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const renderItem = ({ item }: { item: UserProfile }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => {
        setSelectedUser(item);
        setDetailVisible(true);
      }}
    >
      <View style={[styles.avatar, { backgroundColor: '#00AA13' }]}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatarImg} />
        ) : (
          <FontAwesome5 name={item.role === 'owner' ? 'user-tie' : 'user'} size={18} color="#fff" />
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
      <View style={[styles.miniRoleBadge, { backgroundColor: '#E6F6E8' }]}>
        <Text style={[styles.miniRoleText, { color: '#00AA13' }]}>{item.role}</Text>
      </View>
    </TouchableOpacity>
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
          style={[styles.tab, activeTab === 'user' && styles.activeTabGreen]}
          onPress={() => setActiveTab('user')}
        >
          <FontAwesome5 name="users" size={14} color={activeTab === 'user' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'user' && styles.activeTabText]}>Pencari Kost</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'owner' && styles.activeTabGreen]}
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

      {/* Modal Detail User */}
      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Pengguna</Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)} style={styles.closeBtn}>
                <FontAwesome5 name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.mainInfo}>
                  <Image 
                    source={{ uri: selectedUser.photoURL || 'https://via.placeholder.com/150' }} 
                    style={styles.largeAvatar} 
                  />
                  <Text style={styles.detailName}>{selectedUser.name}</Text>
                  <View style={[styles.roleLabel, { backgroundColor: '#00AA13' }]}>
                    <Text style={styles.roleLabelText}>{selectedUser.role?.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.detailGroups}>
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>Email</Text>
                    <Text style={styles.value}>{selectedUser.email}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>WhatsApp</Text>
                    <Text style={styles.value}>{selectedUser.whatsapp || '-'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>Bio</Text>
                    <Text style={styles.value}>{selectedUser.bio || 'Belum ada bio.'}</Text>
                  </View>
                  
                  <Text style={styles.sectionLabel}>Identitas (KTP)</Text>
                  {selectedUser.ktpURL ? (
                    <Image source={{ uri: selectedUser.ktpURL }} style={styles.ktpPreview} resizeMode="contain" />
                  ) : (
                    <View style={styles.noKtp}>
                      <FontAwesome5 name="id-card" size={30} color="#CBD5E1" />
                      <Text style={styles.noKtpText}>KTP Belum Diunggah</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionSection}>
                  <Text style={styles.sectionLabel}>Tindakan Admin</Text>
                  <TouchableOpacity 
                    style={[styles.actionBtnLarge, selectedUser.isVerified ? styles.btnDanger : styles.btnSuccess]}
                    onPress={() => toggleVerification(selectedUser)}
                    disabled={updating}
                  >
                    <FontAwesome5 name={selectedUser.isVerified ? "user-slash" : "user-check"} size={16} color="#fff" />
                    <Text style={styles.btnText}>{selectedUser.isVerified ? 'Cabut Verifikasi' : 'Verifikasi Akun'}</Text>
                  </TouchableOpacity>

                  <View style={styles.roleActions}>
                    <TouchableOpacity 
                      style={[styles.btnOutline, selectedUser.role === 'owner' && styles.disabledBtn]}
                      onPress={() => changeRole(selectedUser, 'owner')}
                      disabled={updating || selectedUser.role === 'owner'}
                    >
                      <Text style={styles.btnOutlineText}>Jadikan Owner</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.btnOutline, selectedUser.role === 'user' && styles.disabledBtn]}
                      onPress={() => changeRole(selectedUser, 'user')}
                      disabled={updating || selectedUser.role === 'user'}
                    >
                      <Text style={styles.btnOutlineText}>Jadikan User</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
  activeTabGreen: { backgroundColor: '#00AA13' },
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
  verifyBtnOwner: { backgroundColor: '#00AA13' },
  unverifyBtn: { backgroundColor: '#EE2737' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#64748b', fontSize: 14, marginTop: 12 },
  miniRoleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  miniRoleText: { fontSize: 10, fontWeight: 'bold' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  closeBtn: { padding: 4 },
  mainInfo: { alignItems: 'center', marginBottom: 30 },
  largeAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16, borderWidth: 3, borderColor: '#F1F5F9' },
  detailName: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 8 },
  roleLabel: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  roleLabelText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  detailGroups: { gap: 20, marginBottom: 30 },
  detailItem: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  value: { fontSize: 15, color: '#1C1C1C', fontWeight: '500' },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginTop: 10, marginBottom: 12 },
  ktpPreview: { width: '100%', height: 200, borderRadius: 16, backgroundColor: '#F8FAFC' },
  noKtp: { height: 150, backgroundColor: '#F8FAFC', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1' },
  noKtpText: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  actionSection: { paddingBottom: 40 },
  actionBtnLarge: { flexDirection: 'row', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 16 },
  btnSuccess: { backgroundColor: '#00AA13' },
  btnDanger: { backgroundColor: '#EE2737' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  roleActions: { flexDirection: 'row', gap: 12 },
  btnOutline: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  disabledBtn: { opacity: 0.4 }
});
