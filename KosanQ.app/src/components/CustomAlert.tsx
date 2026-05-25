import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  Animated, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'logout' | 'delete';
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const { width } = Dimensions.get('window');

export const CustomAlert = ({ 
  visible, 
  title, 
  message, 
  type = 'info', 
  onClose, 
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Batal'
}: CustomAlertProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible]);

  const getTheme = () => {
    switch (type) {
      case 'success': return { icon: 'check', color: '#00AA13', bg: '#E6F6E8', light: '#F0FDF4' };
      case 'error': return { icon: 'times', color: '#EE2737', bg: '#FEE2E2', light: '#FEF2F2' };
      case 'warning': return { icon: 'exclamation', color: '#F59E0B', bg: '#FEF3C7', light: '#FFFBEB' };
      case 'logout': return { icon: 'sign-out-alt', color: '#EE2737', bg: '#FEE2E2', light: '#FEF2F2' };
      case 'delete': return { icon: 'trash', color: '#EE2737', bg: '#FEE2E2', light: '#FEF2F2' };
      default: return { icon: 'info', color: '#0B63F6', bg: '#E0E8F9', light: '#EFF4FF' };
    }
  };

  const theme = getTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.alertBox, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
            }
          ]}
        >
          {/* Header Theme Line */}
          <View style={[styles.headerLine, { backgroundColor: theme.color }]} />

          {/* Floating Icon Wrapper */}
          <View style={[styles.iconWrapper, { backgroundColor: theme.light }]}>
            <View style={[styles.iconInner, { backgroundColor: theme.bg }]}>
              <FontAwesome5 name={theme.icon} size={32} color={theme.color} />
            </View>
          </View>
          
          <View style={styles.contentContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.buttonContainer}>
            {onConfirm && (
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                styles.button, 
                styles.confirmButton,
                { backgroundColor: theme.color }
              ]} 
              onPress={onConfirm || onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Slate-900 with nice opacity
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    alignItems: 'center',
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    position: 'relative',
    marginTop: 40, // Space for floating icon
  },
  headerLine: {
    height: 8,
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    position: 'absolute',
    top: 0,
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -45,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  iconInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    marginTop: 64, // Push content down below floating icon
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButton: {
    // Dynamic bg color
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
