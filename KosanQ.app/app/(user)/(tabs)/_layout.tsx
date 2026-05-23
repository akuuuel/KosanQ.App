import React from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNotifications } from '../../../src/context/NotificationContext';

export default function UserTabsLayout() {
  const { unreadChatCount, newOrderCount, newReportCount, newBroadcastCount } = useNotifications();
  const myKostBadge = newReportCount + newBroadcastCount;

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
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="my-kost"
        options={{
          title: 'Kamar Saya',
          tabBarBadge: myKostBadge > 0 ? myKostBadge : undefined,
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="door-open" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Riwayat',
          tabBarBadge: newOrderCount > 0 ? newOrderCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="history" size={size} color={color} />
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
