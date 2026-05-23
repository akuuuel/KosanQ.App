import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CustomAlert } from "../../src/components/CustomAlert";
import { CustomButton } from "../../src/components/CustomButton";
import { CustomInput } from "../../src/components/CustomInput";
import { auth } from "../../src/services/firebase";

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({
    title: "",
    message: "",
    type: "info" as any,
  });

  const showAlert = (title: string, message: string, type: any = "info") => {
    setAlertData({ title, message, type });
    setAlertVisible(true);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Gagal", "Harap isi semua kolom untuk masuk.", "warning");
      return;
    }

    setLoading(true);
    try {
      // 1. Sign in first (this is always allowed and fast)
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const user = userCredential.user;

      // 2. Fetch profile directly by UID (also allowed and fast)
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../../src/services/firebase");
      const docRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const userDoc = snapshot.data();
        // Default to 'user' if the role field is missing or empty
        const actualRole = String(userDoc.role || "user").toLowerCase().trim();
        const rawTarget = Array.isArray(params.role) ? params.role[0] : params.role;
        const targetRole = String(rawTarget || "").toLowerCase().trim();



        // If targetRole is provided (user or owner), we MUST match it.
        // ADMIN can pass through ANY portal.
        if (targetRole && actualRole !== targetRole && actualRole !== 'admin') {
          // MISMATCH!
          await auth.signOut();
          showAlert(
            "Akses Ditolak",
            "Akun Anda tidak memiliki izin untuk masuk melalui pintu ini.",
            "warning",
          );
          setLoading(false);
          return;
        }

        // If we are here, login is successful and role is correct.
        if (actualRole === 'admin') {
          router.replace("/(owner)" as any);
        } else if (actualRole === 'owner') {
          router.replace("/(owner)" as any);
        } else if (actualRole === 'user') {
          router.replace("/(user)" as any);
        } else {
          router.replace("/(user)" as any);
        }
        return;
      }
    } catch (error: any) {
      let msg = "Terjadi kesalahan saat masuk.";
      switch (error.code) {
        case "auth/invalid-email":
          msg = "Format email tidak valid.";
          break;
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          msg = "Email atau password salah.";
          break;
        case "auth/too-many-requests":
          msg = "Terlalu banyak percobaan. Coba lagi nanti.";
          break;
        case "auth/network-request-failed":
          msg = "Koneksi internet bermasalah.";
          break;
      }
      showAlert("Login Gagal", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>KosanQ</Text>
          <Text style={styles.subtitle}>Temukan hunian nyamanmu di sini</Text>

          {params.role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                Masuk sebagai{" "}
                {params.role === "owner" ? "Pemilik Kost" : "Pencari Kost"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.form}>
          <CustomInput
            label="Email"
            placeholder="Masukkan email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <CustomInput
            label="Password"
            placeholder="Masukkan password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <CustomButton title="Masuk" onPress={handleLogin} loading={loading} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Belum punya akun? </Text>
            <Link
              href={{
                pathname: "/(auth)/register",
                params: { role: params.role },
              }}
              asChild
            >
              <TouchableOpacity>
                <Text style={styles.linkText}>Daftar Sekarang</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>

      <CustomAlert
        visible={alertVisible}
        title={alertData.title}
        message={alertData.message}
        type={alertData.type}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#00AA13",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  roleBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E6F6E8",
    borderWidth: 1,
    borderColor: "#00AA13",
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#00AA13",
  },
  form: {
    width: "100%",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
  },
  linkText: {
    color: "#00AA13",
    fontWeight: "bold",
    fontSize: 14,
  },
});
