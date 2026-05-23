import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  StatusBar,
  Linking,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getKostById } from '../../../src/services/kostService';
import { Kost } from '../../../src/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { createBooking } from '../../../src/services/bookingService';
import { useAuth } from '../../../src/context/AuthContext';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { listenKostReviews } from '../../../src/services/reviewService';
import { Review } from '../../../src/types';

export default function UserKostDetailScreen() {
  const { id } = useLocalSearchParams();
  const { profile } = useAuth();
  const router = useRouter();
  const [kost, setKost] = useState<Kost | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  useEffect(() => {
    if (id) {
      fetchKost();
      const unsubReviews = listenKostReviews(id as string, (data) => {
        setReviews(data);
        if (data.length > 0) {
          const total = data.reduce((acc, curr) => acc + curr.rating, 0);
          setAvgRating(total / data.length);
        }
      });
      return () => unsubReviews();
    }
  }, [id]);

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertData({ title, message, type, onConfirm: onConfirm || (() => setAlertVisible(false)) });
    setAlertVisible(true);
  };

  const fetchKost = async () => {
    try {
      const data = await getKostById(id as string);
      setKost(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!profile || !kost) {
      showAlert('Peringatan', 'Silakan masuk terlebih dahulu untuk memesan kost.', 'warning');
      return;
    }

    // Check if profile is complete
    const isProfileComplete = 
      profile.name && 
      profile.email && 
      profile.whatsapp && 
      profile.photoURL && 
      profile.bio && 
      profile.ktpURL;

    if (!isProfileComplete) {
      showAlert(
        'Profil Belum Lengkap', 
        'Harap lengkapi profil Anda (Nama, Email, WA, Foto, Bio, dan KTP) sebelum mengajukan sewa.', 
        'warning',
        () => {
          setAlertVisible(false);
          router.push('/(user)/edit-profile');
        }
      );
      return;
    }
    
    setBookingLoading(true);
    try {
      await createBooking({
        kostId: kost.id,
        userId: profile.uid,
        userName: profile.name,
        userEmail: profile.email,
        userWhatsapp: profile.whatsapp,
        userBio: profile.bio,
        userPhoto: profile.photoURL,
        userKtp: profile.ktpURL,
        ownerId: kost.ownerId,
        kostName: kost.name,
        kostImage: (kost.images && kost.images.length > 0) ? kost.images[0] : '',
        price: kost.price,
        status: 'pending'
      });
      showAlert('Sukses!', 'Pesanan Anda telah diajukan. Silakan tunggu konfirmasi dari pemilik.', 'success', () => {
        setAlertVisible(false);
        router.push('/(user)/(tabs)/orders');
      });
    } catch (error) {
      console.error('[Booking Error]:', error);
      showAlert('Gagal', 'Gagal mengajukan sewa. Silakan coba lagi nanti.', 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  const openInMaps = () => {
    if (!kost?.latitude || !kost?.longitude) return;
    
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${kost.latitude},${kost.longitude}`;
    const label = kost.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    Linking.openURL(url!);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00AA13" />
      </View>
    );
  }

  if (!kost) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{kost?.name || 'Detail Kost'}</Text>
        <TouchableOpacity style={styles.shareBtn}>
          <FontAwesome5 name="share-alt" size={18} color="#1C1C1C" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {kost.images?.map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.heroImage} />
          )) || (
             <View style={[styles.heroImage, { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]}>
               <FontAwesome5 name="image" size={40} color="#cbd5e1" />
             </View>
          )}
        </ScrollView>

        <View style={styles.content}>
          <View style={styles.mainInfo}>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>Rp {(kost.price || 0).toLocaleString('id-ID')}</Text>
              <Text style={styles.priceUnit}>/ bulan</Text>
            </View>
            <Text style={styles.kostName}>{kost.name}</Text>
            <View style={styles.locationRow}>
              <FontAwesome5 name="map-marker-alt" size={14} color="#64748b" />
              <Text style={styles.locationText}>{kost.location}</Text>
              {reviews.length > 0 && (
                <View style={styles.ratingBadge}>
                  <FontAwesome5 name="star" solid size={10} color="#F59E0B" />
                  <Text style={styles.ratingText}>{avgRating.toFixed(1)} ({reviews.length})</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deskripsi Kost</Text>
            <Text style={styles.descText}>{kost.description || 'Tidak ada deskripsi.'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lokasi</Text>
            {kost.latitude && kost.longitude ? (
              <TouchableOpacity style={styles.mapCard} onPress={openInMaps} activeOpacity={0.85}>
                <View style={styles.mapCardLeft}>
                  <View style={styles.mapIconBox}>
                    <FontAwesome5 name="map-marker-alt" size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mapCardTitle}>Lihat Lokasi di Maps</Text>
                    <Text style={styles.mapCardSub} numberOfLines={2}>{kost.location || 'Koordinat tersedia'}</Text>
                  </View>
                </View>
                <FontAwesome5 name="chevron-right" size={14} color="#00AA13" />
              </TouchableOpacity>
            ) : (
              <View style={styles.noMap}>
                <FontAwesome5 name="map-marked-alt" size={40} color="#e2e8f0" />
                <Text style={styles.noMapText}>Lokasi belum ditetapkan</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ulasan Penghuni ({reviews.length})</Text>
            {reviews.length > 0 ? (
              reviews.map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewUser}>{r.userName}</Text>
                    <View style={styles.starsRow}>
                      {[1,2,3,4,5].map(s => (
                        <FontAwesome5 key={s} name="star" solid={s <= r.rating} size={10} color={s <= r.rating ? "#F59E0B" : "#CBD5E1"} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{r.comment}</Text>
                  <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString('id-ID')}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyReviews}>Belum ada ulasan untuk kost ini.</Text>
            )}
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.chatBtn}
          onPress={() => router.push({
            pathname: '/(user)/chat/[id]',
            params: { id: kost.ownerId, name: 'Pemilik Kost', role: 'owner' }
          })}
        >
          <FontAwesome5 name="comment" size={18} color="#00AA13" />
          <Text style={styles.chatText}>Tanya</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bookBtn}
          onPress={handleBooking}
          disabled={bookingLoading}
        >
          {bookingLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookText}>Ajukan Sewa</Text>
          )}
        </TouchableOpacity>
      </View>

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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: { padding: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1C', flex: 1, marginHorizontal: 12 },
  shareBtn: { padding: 8 },
  imageScroll: { padding: 20 },
  heroImage: { width: 300, height: 200, borderRadius: 20, marginRight: 15 },
  content: { padding: 20 },
  mainInfo: { marginBottom: 20 },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  price: { fontSize: 24, fontWeight: 'bold', color: '#00AA13' },
  priceUnit: { fontSize: 14, color: '#64748b', marginLeft: 4 },
  kostName: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationText: { fontSize: 14, color: '#64748b' },
  divider: { height: 8, backgroundColor: '#F8FAFC', marginHorizontal: -20, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 12 },
  descText: { fontSize: 15, color: '#4A4A4A', lineHeight: 24 },
  mapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  mapCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  mapIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#00AA13',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1C1C1C', marginBottom: 2 },
  mapCardSub: { fontSize: 12, color: '#64748b', flex: 1 },
  noMap: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  noMapText: { marginTop: 12, color: '#94a3b8', fontSize: 14 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 30,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    elevation: 20,
  },
  chatBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00AA13',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chatText: { color: '#00AA13', fontWeight: 'bold' },
  bookBtn: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#00AA13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 10, gap: 4 },
  ratingText: { fontSize: 12, fontWeight: 'bold', color: '#F59E0B' },
  reviewCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewUser: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1C' },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, color: '#4A4A4A', lineHeight: 18 },
  reviewDate: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  emptyReviews: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: 20 },
});
