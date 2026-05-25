import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { FontAwesome5 } from '@expo/vector-icons';

interface MapPickerProps {
  initialLocation?: { latitude: number; longitude: number };
  onLocationSelect: (location: { latitude: number; longitude: number }) => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({ initialLocation, onLocationSelect }) => {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);
  const [currentCoords, setCurrentCoords] = useState(initialLocation || { latitude: -6.2000, longitude: 106.8166 });

  // HTML Peta (Leaflet + OpenStreetMap)
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; touch-action: pan-x pan-y; }
        #map { height: 100vh; width: 100vw; background: #f8fafc; }
        .leaflet-control-attribution { display: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { 
          zoomControl: false,
          dragging: true,
          touchZoom: true,
          tap: false, // Menghindari konflik klik di mobile
          scrollWheelZoom: true
        }).setView([${currentCoords.latitude}, ${currentCoords.longitude}], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: ''
        }).addTo(map);

        var marker;

        if (${!!initialLocation}) {
          marker = L.marker([${currentCoords.latitude}, ${currentCoords.longitude}]).addTo(map);
        }

        map.on('click', function(e) {
          var lat = e.latlng.lat;
          var lng = e.latlng.lng;

          if (marker) {
            marker.setLatLng(e.latlng);
          } else {
            marker = L.marker(e.latlng).addTo(map);
          }

          window.ReactNativeWebView.postMessage(JSON.stringify({
            latitude: lat,
            longitude: lng
          }));
        });

        // Listen for messages from React Native to sync location
        document.addEventListener('message', function(event) {
          var data = JSON.parse(event.data);
          if (data.type === 'sync') {
            map.setView([data.lat, data.lng], 17); // Zoom diperdalam saat mencari alamat
            if (marker) {
              marker.setLatLng([data.lat, data.lng]);
            } else {
              marker = L.marker([data.lat, data.lng]).addTo(map);
            }
          }
        });
      </script>
    </body>
    </html>
  `;

  // Sinkronisasi peta saat initialLocation berubah (misal dari hasil pencarian alamat)
  useEffect(() => {
    if (initialLocation && !loading) {
      // Beri sedikit delay agar WebView benar-benar siap menerima pesan
      const timer = setTimeout(() => {
        syncMap(initialLocation.latitude, initialLocation.longitude);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialLocation?.latitude, initialLocation?.longitude, loading]);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        if (!initialLocation) {
          let location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low, // Menggunakan akurasi rendah agar lebih cepat dan stabil
          });
          syncMap(location.coords.latitude, location.coords.longitude);
        }
      } catch (error) {
        console.warn('Gagal mengambil lokasi GPS:', error);
        // Tetap di koordinat default jika GPS gagal
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const syncMap = (lat: number, lng: number) => {
    setCurrentCoords({ latitude: lat, longitude: lng });
    webViewRef.current?.postMessage(JSON.stringify({ type: 'sync', lat, lng }));
  };

  const handleMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    onLocationSelect(data);
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        style={styles.map}
        nestedScrollEnabled={true}
        scrollEnabled={false}
      />
      
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#00AA13" />
        </View>
      )}

      <View style={styles.overlay}>
        <Text style={styles.hint}>Tekan peta untuk menetapkan titik lokasi kost</Text>
      </View>

      <TouchableOpacity 
        style={styles.currentLocBtn}
        onPress={async () => {
          try {
            let location = await Location.getCurrentPositionAsync({});
            syncMap(location.coords.latitude, location.coords.longitude);
            onLocationSelect({ latitude: location.coords.latitude, longitude: location.coords.longitude });
          } catch (err) {
            alert('GPS tidak aktif atau izin ditolak. Silakan ketik alamat di kolom atas untuk mencari lokasi kost.');
          }
        }}
      >
        <FontAwesome5 name="crosshairs" size={20} color="#00AA13" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 350,
    borderRadius: 20,
    overflow: 'hidden',
    marginVertical: 10,
    backgroundColor: '#F1F5F9',
    position: 'relative'
  },
  map: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  overlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  hint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: 'bold',
  },
  currentLocBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  }
});
