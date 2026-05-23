import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StatusBar } from 'react-native';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../src/services/firebase';
import { CustomInput } from '../../src/components/CustomInput';
import { CustomButton } from '../../src/components/CustomButton';
import { CustomAlert } from '../../src/components/CustomAlert';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { UserRole } from '../../src/types';
import { validateEmail, validatePassword, validateRequiredFields } from '../../src/utils/validation';

export default function RegisterScreen() {
  const params = useLocalSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>((params.role as UserRole) || 'user');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };
  const handleRegister = async () => {
    const validationError = validateRequiredFields({ Nama: name, Email: email, Password: password });
    if (validationError) {
      showAlert('Gagal', validationError, 'warning');
      return;
    }

    if (!validateEmail(email)) {
      showAlert('Gagal', 'Format email tidak valid.', 'warning');
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      showAlert('Gagal', passwordCheck.message, 'warning');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Simpan profile ke Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      });

      // Kirim email verifikasi (Production requirement)
      try {
        await sendEmailVerification(user);
      } catch (evError) {
        console.warn('Error sending verification email:', evError);
      }

      showAlert('Sukses!', 'Akun berhasil dibuat. Harap cek kotak masuk email Anda untuk melakukan verifikasi akun.', 'success', () => {
        setAlertVisible(false);
      });
    } catch (error: any) {

      showAlert('Registrasi Gagal', 'Maaf, terjadi kesalahan saat membuat akun. Harap coba lagi atau gunakan email lain.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Daftar Akun</Text>
          <Text style={styles.subtitle}>Gabung dengan komunitas KosanQ</Text>
        </View>

        <View style={styles.form}>
          <CustomInput
            label="Nama Lengkap"
            placeholder="Masukkan nama lengkap"
            value={name}
            onChangeText={setName}
          />
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

          <Text style={styles.label}>Daftar Sebagai:</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity 
              style={[styles.roleButton, role === 'user' && styles.roleButtonActive]} 
              onPress={() => setRole('user')}
            >
              <Text style={[styles.roleText, role === 'user' && styles.roleTextActive]}>Pencari Kost</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.roleButton, role === 'owner' && styles.roleButtonActive]} 
              onPress={() => setRole('owner')}
            >
              <Text style={[styles.roleText, role === 'owner' && styles.roleTextActive]}>Pemilik Kost</Text>
            </TouchableOpacity>
          </View>

          <CustomButton
            title="Daftar Sekarang"
            onPress={handleRegister}
            loading={loading}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Sudah punya akun? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Masuk Di Sini</Text>
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
        onConfirm={alertData.onConfirm}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#00AA13',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  roleButtonActive: {
    borderColor: '#00AA13',
    backgroundColor: '#E6F6E8',
  },
  roleText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#00AA13',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#64748b',
    fontSize: 14,
  },
  linkText: {
    color: '#00AA13',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
