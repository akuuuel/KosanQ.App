import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

export const CustomButton: React.FC<ButtonProps> = ({ 
  title, 
  onPress, 
  loading, 
  disabled,
  variant = 'primary',
  style 
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary': return styles.secondary;
      case 'danger': return styles.danger;
      default: return styles.primary;
    }
  };

  const isButtonDisabled = loading || disabled;

  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        getButtonStyle(), 
        style,
        isButtonDisabled && styles.disabled
      ]} 
      onPress={onPress}
      disabled={isButtonDisabled}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primary: {
    backgroundColor: '#00AA13', // Gojek Green
  },
  secondary: {
    backgroundColor: '#64748b', // Slate
  },
  danger: {
    backgroundColor: '#EE2737', // Gojek-like Red
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
