import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../src/services/firebase";

export default function AdminDashboardIndex() {
  const [stats, setStats] = useState({
    users: 0,
    owners: 0,
    kosts: 0,
    pendingKosts: 0,
    bookings: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [usersSnap, kostsSnap, pendingSnap, bookingsSnap] =
        await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "kosts")),
          getDocs(
            query(collection(db, "kosts"), where("status", "==", "pending")),
          ),
          getDocs(collection(db, "bookings")),
        ]);

      const allUsers = usersSnap.docs.map((d) => d.data());
      const ownersCount = allUsers.filter((u: any) => u.role === "owner").length;
      const normalUsersCount = allUsers.filter((u: any) => u.role === "user").length;

      // Calculate total revenue from successful bookings
      const totalRevenue = bookingsSnap.docs.reduce((acc, doc) => {
        const data = doc.data();
        if (data.status === 'completed') {
          return acc + (data.totalPrice || 0);
        }
        return acc;
      }, 0);

      setStats({
        users: normalUsersCount,
        owners: ownersCount,
        kosts: kostsSnap.size,
        pendingKosts: pendingSnap.size,
        bookings: bookingsSnap.size,
        revenue: totalRevenue,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color, onPress }: any) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: color + "15" }]}>
        <FontAwesome5 name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Super Admin</Text>
          <Text style={styles.subtitle}>Ringkasan Ekosistem KosanQ</Text>
        </View>
        <TouchableOpacity
          onPress={() => signOut(auth)}
          style={styles.logoutBtn}
        >
          <FontAwesome5 name="power-off" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#00AA13"
            style={{ marginTop: 40 }}
          />
        ) : (
          <>
            <View style={styles.statGrid}>
              <StatCard
                title="Pencari Kost"
                value={stats.users}
                icon="users"
                color="#3b82f6"
                onPress={() => router.push("/(admin)/users")}
              />
              <StatCard
                title="Pemilik Kost"
                value={stats.owners}
                icon="user-tie"
                color="#ec4899"
                onPress={() => router.push("/(admin)/users")}
              />
              <StatCard
                title="Total Properti"
                value={stats.kosts}
                icon="home"
                color="#8b5cf6"
                onPress={() => router.push("/(admin)/kosts")}
              />
              <StatCard
                title="Transaksi"
                value={stats.bookings}
                icon="receipt"
                color="#f59e0b"
                onPress={() => router.push("/(admin)/transactions")}
              />
            </View>

            <View style={styles.revenueCard}>
              <View style={styles.revenueInfo}>
                <Text style={styles.revenueLabel}>Total Perputaran Uang</Text>
                <Text style={styles.revenueValue}>Rp {stats.revenue.toLocaleString('id-ID')}</Text>
              </View>
              <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
                <FontAwesome5 name="wallet" size={20} color="#00AA13" />
              </View>
            </View>

            {stats.pendingKosts > 0 && (
              <TouchableOpacity
                style={styles.alertBanner}
                onPress={() => router.push("/(admin)/verification")}
              >
                <FontAwesome5
                  name="exclamation-circle"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.alertText}>
                  Ada {stats.pendingKosts} pengajuan kost baru yang butuh
                  verifikasi!
                </Text>
                <FontAwesome5 name="chevron-right" size={14} color="#fff" />
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>Aksi Cepat</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.actionItem} disabled>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#F0F9FF" }]}
                >
                  <FontAwesome5
                    name="file-invoice-dollar"
                    size={20}
                    color="#0EA5E9"
                  />
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonText}>Soon</Text>
                  </View>
                </View>
                <Text style={styles.actionText}>Laporan Keuangan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => router.push("/(admin)/security-audit")}>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}
                >
                  <FontAwesome5 name="shield-alt" size={20} color="#10B981" />
                </View>
                <Text style={styles.actionText}>Audit Keamanan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => router.push("/(admin)/broadcast-promo")}>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#FFF7ED" }]}
                >
                  <FontAwesome5 name="bullhorn" size={20} color="#F97316" />
                </View>
                <Text style={styles.actionText}>Broadcast Promo</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#00AA13",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: { fontSize: 24, fontWeight: "900", color: "#fff" },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: { padding: 20 },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  statCard: {
    backgroundColor: "#fff",
    width: "48%",
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "bold", color: "#1C1C1C" },
  statTitle: { fontSize: 12, color: "#64748b" },
  alertBanner: {
    backgroundColor: "#f59e0b",
    padding: 16,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  revenueCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E6F6E8',
  },
  revenueInfo: { flex: 1 },
  revenueLabel: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  revenueValue: { fontSize: 24, fontWeight: '900', color: '#1C1C1C' },
  alertText: { color: "#fff", fontWeight: "bold", flex: 1, fontSize: 14 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1C1C1C",
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionItem: {
    width: "30%",
    alignItems: "center",
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionText: {
    textAlign: "center",
    color: "#4A4A4A",
    fontWeight: "600",
  },
  soonBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#64748b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  soonText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "bold",
  },
});
