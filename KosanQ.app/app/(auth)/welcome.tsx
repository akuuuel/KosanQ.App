import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>KosanQ</Text>
          <Text style={styles.subtitle}>Solusi Hunian Praktis & Terpercaya</Text>
        </View>

        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1555854817-5b2738a915c4?q=80&w=800&auto=format&fit=crop' }} 
          style={styles.heroImage} 
        />

        <View style={styles.selectionArea}>
          <Text style={styles.selectionTitle}>Selamat Datang!</Text>
          <Text style={styles.selectionDesc}>Pilih peran Anda untuk memulai pengalaman terbaik bersama KosanQ</Text>
          
          <TouchableOpacity 
            style={styles.choiceCard}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: 'user' } })}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E6F6E8' }]}>
              <FontAwesome5 name="search" size={20} color="#00AA13" />
            </View>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>Pencari Kost</Text>
              <Text style={styles.choiceSubtitle}>Temukan kost sesuai budgetmu</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={14} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.choiceCard}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: 'owner' } })}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E6F6E8' }]}>
              <FontAwesome5 name="home" size={20} color="#00AA13" />
            </View>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>Pemilik Kost</Text>
              <Text style={styles.choiceSubtitle}>Kelola dan iklankan kostmu di sini</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={14} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#00AA13',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    marginBottom: 40,
  },
  selectionArea: {
  },
  selectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 8,
  },
  selectionDesc: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
    lineHeight: 20,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 4,
    shadowColor: '#00AA13',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  choiceText: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1C1C1C',
  },
  choiceSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
});
