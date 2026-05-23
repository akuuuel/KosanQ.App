import React from 'react';
import { Stack } from 'expo-router';

export default function OwnerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Group Tabs sebagai satu layar di dalam Stack */}
      <Stack.Screen name="(tabs)" />
      
      {/* Layar Tambah dan Edit akan muncul di atas Tabs (Full Screen) */}
      <Stack.Screen 
        name="add-kost" 
        options={{ 
          presentation: 'card',
        }} 
      />
      
      <Stack.Screen 
        name="edit-kost/[id]" 
        options={{ 
          presentation: 'card',
        }} 
      />

      <Stack.Screen 
        name="chat/[id]" 
        options={{ 
          presentation: 'card',
        }} 
      />

      <Stack.Screen 
        name="rooms" 
        options={{ 
          presentation: 'card',
        }} 
      />

      <Stack.Screen 
        name="tenants" 
        options={{ 
          presentation: 'card',
        }} 
      />

      <Stack.Screen 
        name="payments" 
        options={{ 
          presentation: 'card',
        }} 
      />

      <Stack.Screen 
        name="edit-profile" 
        options={{ 
          title: 'Edit Profil',
          headerShown: false,
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
