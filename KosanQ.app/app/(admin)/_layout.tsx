import React from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNotifications } from '../../src/context/NotificationContext';

export default function AdminLayout() {
  const { pendingKostsCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00AA13',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          height: 70,
          paddingBottom: 12,
          paddingTop: 10,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          position: 'absolute',
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="chart-pie" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="verification"
        options={{
          title: 'Verifikasi',
          tabBarBadge: pendingKostsCount > 0 ? pendingKostsCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="clipboard-check" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Pengguna',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="users" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden sub-pages — accessible via router.push but NOT shown in tab bar */}
      <Tabs.Screen name="kosts" options={{ href: null }} />
      <Tabs.Screen name="transactions" options={{ href: null }} />
      <Tabs.Screen name="broadcast-promo" options={{ href: null }} />
      <Tabs.Screen name="security-audit" options={{ href: null }} />
    </Tabs>
  );
}
