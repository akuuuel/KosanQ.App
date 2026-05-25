import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput,
  StatusBar
} from 'react-native';
import { getApprovedKosts } from '../../../src/services/kostService';
import { Kost } from '../../../src/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';

export default function UserHomeScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchKosts();
      getUserLocation();
    }, [])
  );

  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    } catch (error) {
      console.warn('[Location] Lokasi tidak tersedia:', error);
      // Aplikasi tetap berjalan tanpa data lokasi
    }
  };

  const calculateDistance = (lat1: any, lon1: any, lat2: any, lon2: any) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // km
    const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const fetchKosts = async () => {
    setLoading(true);
    try {
      const data = await getApprovedKosts();
      setKosts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const displayKosts = React.useMemo(() => {
    let results = [...kosts];

    // Filter by Search
    if (search) {
      const lowerSearch = search.toLowerCase();
      results = results.filter(item => 
        item.name.toLowerCase().includes(lowerSearch) || 
        item.location.toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by Category (Quick Actions)
    if (category) {
      if (category === 'Terdekat') {
        if (userLocation) {
          results.sort((a, b) => {
            if (!a.latitude || !b.latitude) return 0;
            const distA = calculateDistance(userLocation.coords.latitude, userLocation.coords.longitude, a.latitude!, a.longitude!);
            const distB = calculateDistance(userLocation.coords.latitude, userLocation.coords.longitude, b.latitude!, b.longitude!);
            return distA - distB;
          });
        }
      } else {
        const lowerCat = category.toLowerCase();
        results = results.filter(item => item.type?.toLowerCase() === lowerCat);
      }
    }

    return results;
  }, [kosts, search, category, userLocation]);

  const handleSearch = (text: string) => setSearch(text);

  const renderKostItem = ({ item }: { item: Kost }) => {
    let distance = null;
    if (userLocation && item.latitude && item.longitude) {
      distance = calculateDistance(userLocation.coords.latitude, userLocation.coords.longitude, item.latitude, item.longitude);
    }

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9}
        onPress={() => router.push(`/(user)/kost/${item.id}` as any)}
      >
        <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTag}>
              <Text style={styles.cardTagText}>Tersedia</Text>
            </View>
            {distance !== null && distance < 10 && (
              <View style={[styles.cardTag, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.cardTagText, { color: '#00AA13' }]}>
                  {distance.toFixed(1)} km
                </Text>
              </View>
            )}
            {item.averageRating && (
              <View style={styles.cardRating}>
                <FontAwesome5 name="star" solid size={10} color="#F59E0B" />
                <Text style={styles.ratingText}>{item.averageRating.toFixed(1)} ({item.totalReviews})</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.locationRow}>
            <FontAwesome5 name="map-marker-alt" size={12} color="#64748b" />
            <Text style={styles.cardLocation}>{item.location}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.cardPrice}>Rp {item.price.toLocaleString('id-ID')}</Text>
            <Text style={styles.priceUnit}>/ bulan</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00AA13" />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcome}>Halo, {profile?.name || 'Sahabat Kos'}!</Text>
            <Text style={styles.subtitle}>Mau cari kost di mana hari ini?</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              {profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.headerAvatar} />
              ) : (
                <FontAwesome5 name="user-circle" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBar}>
          <FontAwesome5 name="search" size={16} color="#4A4A4A" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari lokasi, nama kost..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </View>
      
      {loading ? (
        <View style={styles.listContent}>
          {/* Skeletons for Quick Actions */}
          <View style={[styles.quickActions, { paddingHorizontal: 0 }]}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.actionItem}>
                <SkeletonLoader width={48} height={48} borderRadius={14} style={{ marginBottom: 6 }} />
                <SkeletonLoader width={30} height={10} />
              </View>
            ))}
          </View>
          
          <View style={[styles.sectionHeader, { paddingHorizontal: 0 }]}>
            <SkeletonLoader width={180} height={20} />
          </View>

          <View style={[styles.columnWrapper, { flexDirection: 'row', flexWrap: 'wrap' }]}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.card, { marginBottom: 16 }]}>
                <SkeletonLoader width="100%" height={140} />
                <View style={[styles.cardContent, { gap: 8 }]}>
                  <SkeletonLoader width={80} height={15} />
                  <SkeletonLoader width="100%" height={20} />
                  <SkeletonLoader width={100} height={15} />
                  <SkeletonLoader width={120} height={20} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          key={2} // Force re-render for column change
          numColumns={2}
          data={displayKosts}
          keyExtractor={(item) => item.id}
          renderItem={renderKostItem}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          ListHeaderComponent={
            <>
              {/* Quick Actions */}
              <View style={styles.quickActions}>
                {[
                  { name: 'Putra', icon: 'mars', color: '#3b82f6', value: 'Putra' },
                  { name: 'Putri', icon: 'venus', color: '#ec4899', value: 'Putri' },
                  { name: 'Campur', icon: 'user-friends', color: '#10b981', value: 'Campur' },
                  { name: 'Terdekat', icon: 'map-marker-alt', color: '#f59e0b', value: 'Terdekat' },
                ].map((action, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.actionItem}
                    onPress={() => setCategory(category === action.value ? null : action.value)}
                  >
                    <View style={[
                      styles.actionIcon, 
                      { backgroundColor: category === action.value ? action.color : action.color + '20' }
                    ]}>
                      <FontAwesome5 name={action.icon} size={20} color={category === action.value ? '#fff' : action.color} />
                    </View>
                    <Text style={[
                      styles.actionText,
                      category === action.value && { color: action.color, fontWeight: 'bold' }
                    ]}>
                      {action.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Rekomendasi Terdekat</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAll}>Lihat Semua</Text>
                </TouchableOpacity>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="search-minus" size={60} color="#e2e8f0" />
              <Text style={styles.emptyText}>Yah, kost belum ketemu...</Text>
              <Text style={styles.emptySubtext}>Coba ganti kata kunci pencarianmu ya.</Text>
            </View>
          }
          onRefresh={fetchKosts}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#00AA13',
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1C',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 10,
  },
  actionItem: {
    alignItems: 'center',
    width: '22%',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4A4A4A',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1C',
  },
  seeAll: {
    fontSize: 13,
    color: '#00AA13',
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 150,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '48%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardImage: {
    width: '100%',
    height: 140,
  },
  cardContent: {
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  cardTag: {
    backgroundColor: '#E6F6E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardTagText: {
    color: '#00AA13',
    fontSize: 9,
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLocation: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 4,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#00AA13',
  },
  priceUnit: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    width: '100%',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1C',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  cardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  ratingText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
});
