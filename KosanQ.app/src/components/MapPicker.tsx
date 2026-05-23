import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { FontAwesome5 } from '@expo/vector-icons';

interface MapPickerProps {
  initialLocation?: { latitude: number; longitude: number };
  onLocationSelect: (location: { latitude: number; longitude: number }) => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({ initialLocation, onLocationSelect }) => {
  const [region, setRegion] = useState({
    latitude: initialLocation?.latitude || -6.2000, // Default Jakarta
    longitude: initialLocation?.longitude || 106.8166,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [marker, setMarker] = useState(initialLocation || null);

  useEffect(() => {
    if (initialLocation) {
      setRegion({
        ...region,
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      });
      setMarker(initialLocation);
    }
  }, [initialLocation]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      if (!initialLocation) {
        let location = await Location.getCurrentPositionAsync({});
        const newRegion = {
          ...region,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setRegion(newRegion);
      }
    })();
  }, []);

  const handleMapPress = (e: any) => {
    const coords = e.nativeEvent.coordinate;
    setMarker(coords);
    onLocationSelect(coords);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onPress={handleMapPress}
        onRegionChangeComplete={setRegion}
      >
        {marker && <Marker coordinate={marker} />}
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.hint}>Tekan peta untuk menetapkan titik lokasi kost</Text>
      </View>
      <TouchableOpacity 
        style={styles.currentLocBtn}
        onPress={async () => {
          let location = await Location.getCurrentPositionAsync({});
          setRegion({
            ...region,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }}
      >
        <FontAwesome5 name="crosshairs" size={20} color="#059669" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 10,
    backgroundColor: '#f1f5f9',
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  hint: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'bold',
  },
  currentLocBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  }
});
