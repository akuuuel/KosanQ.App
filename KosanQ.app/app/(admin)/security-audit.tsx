import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';

interface AuditItem {
  id: string;
  title: string;
  description: string;
  status: 'critical' | 'warning' | 'ok';
  actionLabel?: string;
  onAction?: () => void;
}

export default function SecurityAuditScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [summary, setSummary] = useState({
    issues: 0,
    warnings: 0,
    passed: 0
  });

  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    setLoading(true);
    const items: AuditItem[] = [];
    let issues = 0;
    let warnings = 0;
    let passed = 0;

    try {
      // 1. Audit Owners without KTP
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const owners = allUsers.filter((u: any) => u.role === 'owner');
      const ownersWithoutKtp = owners.filter((u: any) => !u.ktpURL);
      
      if (ownersWithoutKtp.length > 0) {
        items.push({
          id: 'owners-no-ktp',
          title: 'Pemilik Tanpa KTP',
          description: `${ownersWithoutKtp.length} pemilik kost belum mengunggah foto KTP. Ini berisiko tinggi.`,
          status: 'critical',
          actionLabel: 'Lihat Pengguna',
          onAction: () => router.push('/(admin)/users')
        });
        issues++;
      } else {
        passed++;
      }

      // 2. Audit Unverified Kosts
      const kostsSnap = await getDocs(collection(db, 'kosts'));
      const allKosts = kostsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const pendingKosts = allKosts.filter((k: any) => k.status === 'pending');
      
      if (pendingKosts.length > 0) {
        items.push({
          id: 'pending-kosts',
          title: 'Antrean Verifikasi',
          description: `${pendingKosts.length} kost menunggu verifikasi. Segera review untuk keamanan data.`,
          status: 'warning',
          actionLabel: 'Verifikasi Sekarang',
          onAction: () => router.push('/(admin)/verification')
        });
        warnings++;
      } else {
        passed++;
      }

      // 3. Audit Users with missing WhatsApp
      const usersNoWa = allUsers.filter((u: any) => !u.whatsapp && u.role !== 'admin');
      if (usersNoWa.length > (allUsers.length * 0.3)) {
        items.push({
          id: 'users-no-wa',
          title: 'Kontak Tidak Lengkap',
          description: `Lebih dari 30% pengguna tidak mencantumkan nomor WhatsApp. Menyulitkan koordinasi.`,
          status: 'warning'
        });
        warnings++;
      } else {
        passed++;
      }

      // 4. Audit Kosts without images
      const kostsNoImages = allKosts.filter((k: any) => !k.images || k.images.length === 0);
      if (kostsNoImages.length > 0) {
        items.push({
          id: 'kosts-no-images',
          title: 'Kost Tanpa Foto',
          description: `${kostsNoImages.length} kost terdaftar tanpa foto. Berpotensi sebagai data spam/palsu.`,
          status: 'critical',
          actionLabel: 'Kelola Kost',
          onAction: () => router.push('/(admin)/kosts')
        });
        issues++;
      } else {
        passed++;
      }

      setAuditItems(items);
      setSummary({ issues, warnings, passed });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal menjalankan audit sistem.');
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'critical': return <FontAwesome5 name="exclamation-triangle" size={18} color="#EF4444" />;
      case 'warning': return <FontAwesome5 name="exclamation-circle" size={18} color="#F59E0B" />;
      case 'ok': return <FontAwesome5 name="check-circle" size={18} color="#10B981" />;
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audit Keamanan Sistem</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00AA13" />
          <Text style={styles.loadingText}>Menjalankan audit...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.summaryValue, { color: '#B91C1C' }]}>{summary.issues}</Text>
              <Text style={styles.summaryLabel}>Kritis</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.summaryValue, { color: '#92400E' }]}>{summary.warnings}</Text>
              <Text style={styles.summaryLabel}>Peringatan</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.summaryValue, { color: '#166534' }]}>{summary.passed}</Text>
              <Text style={styles.summaryLabel}>Lolos</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Temuan Audit</Text>
          {auditItems.length === 0 ? (
            <View style={styles.allClear}>
              <View style={styles.checkCircle}>
                <FontAwesome5 name="shield-alt" size={40} color="#10B981" />
              </View>
              <Text style={styles.allClearTitle}>Sistem Aman</Text>
              <Text style={styles.allClearSub}>Tidak ditemukan masalah keamanan yang mendesak.</Text>
            </View>
          ) : (
            auditItems.map(item => (
              <View key={item.id} style={styles.auditCard}>
                <View style={styles.auditHeader}>
                  <StatusIcon status={item.status} />
                  <Text style={styles.auditTitle}>{item.title}</Text>
                </View>
                <Text style={styles.auditDesc}>{item.description}</Text>
                {item.onAction && (
                  <TouchableOpacity style={styles.auditAction} onPress={item.onAction}>
                    <Text style={styles.actionText}>{item.actionLabel}</Text>
                    <FontAwesome5 name="chevron-right" size={10} color="#3b82f6" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          <TouchableOpacity style={styles.refreshBtn} onPress={runAudit}>
            <FontAwesome5 name="sync-alt" size={14} color="#fff" />
            <Text style={styles.refreshText}>Jalankan Ulang Audit</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: '#64748b', fontWeight: '500' },
  scrollContent: { padding: 20 },
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  summaryCard: { width: '30%', padding: 16, borderRadius: 20, alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase', opacity: 0.7 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 16 },
  auditCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 2 },
  auditHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  auditTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C' },
  auditDesc: { fontSize: 13, color: '#64748b', lineHeight: 20 },
  auditAction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionText: { fontSize: 13, color: '#3b82f6', fontWeight: 'bold' },
  allClear: { alignItems: 'center', marginTop: 40, padding: 40, backgroundColor: '#fff', borderRadius: 30 },
  checkCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  allClearTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C' },
  allClearSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8 },
  refreshBtn: { backgroundColor: '#00AA13', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 15, marginTop: 20, marginBottom: 40 },
  refreshText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});
