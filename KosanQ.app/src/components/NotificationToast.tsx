import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Vibration } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';

export interface NotificationToastRef {
  show: (title: string, message: string, data?: any, onPress?: () => void) => void;
}

export const NotificationToast = forwardRef<NotificationToastRef>((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [pressAction, setPressAction] = useState<(() => void) | null>(null);
  const translateY = useState(new Animated.Value(-150))[0];
  // Track auto-hide timeout for proper cleanup
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');

  const playFeedback = async () => {
    // Native vibration — always available, no permissions needed
    Vibration.vibrate(80);
    // Play sound via new expo-audio player
    try {
      player.play();
    } catch (_) {}
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Animated.timing(translateY, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setPressAction(null);
    });
  };

  useImperativeHandle(ref, () => ({
    show(t, m, _data, onPress) {
      // Clear any pending auto-hide
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setTitle(t);
      setMessage(m);
      setPressAction(() => onPress || null);
      setVisible(true);
      playFeedback();

      Animated.spring(translateY, {
        toValue: 50,
        useNativeDriver: true,
        damping: 15,
        stiffness: 120,
      }).start();

      timeoutRef.current = setTimeout(hide, 5000);
    }
  }));

  const handlePress = () => {
    if (pressAction) pressAction();
    hide();
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <TouchableOpacity activeOpacity={0.88} style={styles.content} onPress={handlePress}>
        <View style={styles.iconContainer}>
          <FontAwesome5 name="bell" size={18} color="#00AA13" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          <Text style={styles.messageText} numberOfLines={2}>{message}</Text>
        </View>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <FontAwesome5 name="times" size={12} color="#94a3b8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00AA13',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: { flex: 1, marginRight: 8 },
  titleText: { fontSize: 14, fontWeight: '700', color: '#1C1C1C', marginBottom: 2 },
  messageText: { fontSize: 13, color: '#64748b', lineHeight: 18 },
});
