import React from 'react';
import { Stack } from 'expo-router';

export default function UserLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Tab bar as the main entry */}
      <Stack.Screen name="(tabs)" />
      
      {/* Full screen pages */}
      <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="kost/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="my-room" options={{ presentation: 'card' }} />
    </Stack>
  );
}
