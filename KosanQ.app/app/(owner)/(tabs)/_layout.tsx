import React from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNotifications } from '../../../src/context/NotificationContext';

export default function TabsLayout() {
  const { unreadChatCount, newOrderCount, newReportCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00AA13',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          height: 65,
          paddingBottom: 10,
          paddingTop: 5,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          position: 'absolute',
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          backgroundColor: '#fff',
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
          title: 'Kost Saya',
          tabBarBadge: newReportCount > 0 ? newReportCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="house-user" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pesanan',
          tabBarBadge: newOrderCount > 0 ? newOrderCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="clipboard-list" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarBadge: unreadChatCount > 0 ? unreadChatCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="comment-dots" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="user-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
