import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { listenOwnerReports, updateReport } from '../../src/services/reportService';
import { Report } from '../../src/types';
import { CustomButton } from '../../src/components/CustomButton';

export default function OwnerReportsScreen() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');

  const pendingReports = reports.filter(r => r.status === 'pending');
  const doneReports = reports.filter(r => r.status === 'done');

  useEffect(() => {
    if (profile?.uid) {
      const unsubscribe = listenOwnerReports(profile.uid, (data) => {
        setReports(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [profile?.uid]);

  const handleOpenResponse = (report: Report) => {
    setSelectedReport(report);
    setResponseText(report.response || '');
    setResponseModalVisible(true);
  };

  const handleSaveResponse = async () => {
    if (!selectedReport || !responseText.trim()) return;
    setSubmitting(true);
    try {
      await updateReport(selectedReport.id, {
        response: responseText.trim(),
        responseAt: Date.now(),
        status: 'done'
      });
      setResponseModalVisible(false);
      Alert.alert('Sukses', 'Tanggapan laporan telah dikirim ke penyewa.');
    } catch (error) {
      Alert.alert('Error', 'Gagal menyimpan tanggapan.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderReport = ({ item }: { item: Report }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.userInfo}>
          <FontAwesome5 name="user-circle" size={16} color="#64748b" />
          <Text style={styles.userName}>{item.userName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'pending' ? '#FEF2F2' : '#E6F6E8' }]}>
          <Text style={[styles.statusText, { color: item.status === 'pending' ? '#EF4444' : '#00AA13' }]}>
            {item.status === 'pending' ? 'Pending' : 'Selesai'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.roomInfo}>Kamar {item.roomNumber}</Text>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.date}>{new Date(item.createdAt).toLocaleString('id-ID')}</Text>

      {item.response && (
        <View style={styles.responseBox}>
          <Text style={styles.responseLabel}>Tanggapan Anda:</Text>
          <Text style={styles.responseText}>{item.response}</Text>
        </View>
      )}

      <TouchableOpacity 
        style={styles.actionBtn} 
        onPress={() => handleOpenResponse(item)}
      >
        <Text style={styles.actionBtnText}>
          {item.status === 'pending' ? 'Tanggapi Laporan' : 'Edit Tanggapan'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Laporan Masalah</Text>
        <Text style={styles.subtitle}>Pantau dan tanggapi keluhan dari penyewa Anda</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
          {pendingReports.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingReports.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'done' && styles.activeTab]}
          onPress={() => setActiveTab('done')}
        >
          <Text style={[styles.tabText, activeTab === 'done' && styles.activeTabText]}>Selesai</Text>
          {doneReports.length > 0 && (
            <View style={[styles.badge, { backgroundColor: '#E6F6E8' }]}>
              <Text style={[styles.badgeText, { color: '#00AA13' }]}>{doneReports.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00AA13" />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'pending' ? pendingReports : doneReports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="clipboard-check" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>Belum ada laporan</Text>
              <Text style={styles.emptySubtext}>Semua keluhan penyewa akan muncul di sini</Text>
            </View>
          }
        />
      )}

      <Modal visible={responseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tanggapi Laporan</Text>
            <Text style={styles.modalSub}>Kamar {selectedReport?.roomNumber} - {selectedReport?.userName}</Text>
            
            <View style={styles.reportPreview}>
              <Text style={styles.previewLabel}>Keluhan:</Text>
              <Text style={styles.previewText}>{selectedReport?.message}</Text>
            </View>

            <Text style={styles.label}>Tanggapan Anda</Text>
            <TextInput 
              style={styles.textArea}
              placeholder="Tulis solusi atau tanggapan Anda di sini..."
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <CustomButton 
                title="Kirim Tanggapan" 
                onPress={handleSaveResponse} 
                loading={submitting}
              />
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setResponseModalVisible(false)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
            </View>
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
  listContent: { padding: 20, paddingBottom: 40 },
  reportCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  roomInfo: { fontSize: 13, color: '#00AA13', fontWeight: 'bold', marginBottom: 4 },
  message: { fontSize: 15, color: '#4A4A4A', lineHeight: 22, marginBottom: 8 },
  date: { fontSize: 11, color: '#94a3b8', marginBottom: 12 },
  responseBox: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, marginBottom: 16 },
  responseLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  responseText: { fontSize: 14, color: '#1C1C1C' },
  actionBtn: { backgroundColor: '#E6F6E8', padding: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#00AA13', fontWeight: 'bold', fontSize: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  reportPreview: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  previewLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  previewText: { fontSize: 14, color: '#4A4A4A' },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  textArea: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 16, textAlignVertical: 'top', fontSize: 14, color: '#1C1C1C', marginBottom: 20, minHeight: 100 },
  modalActions: { gap: 10 },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: 'bold' },

  // Tab Styles
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', padding: 4, marginHorizontal: 20, marginTop: -20, borderRadius: 12, elevation: 4 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  activeTab: { backgroundColor: '#E6F6E8' },
  tabText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  activeTabText: { color: '#00AA13' },
  badge: { backgroundColor: '#EF4444', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});
