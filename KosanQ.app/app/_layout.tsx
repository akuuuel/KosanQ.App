import React, { useEffect, useRef, useCallback } from "react";
import { Stack, useRouter, useSegments, useLocalSearchParams } from "expo-router";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { NotificationProvider } from "../src/context/NotificationContext";
import { ActivityIndicator, View } from "react-native";
import { NotificationToast, NotificationToastRef } from "../src/components/NotificationToast";
import { setGlobalNotificationRef } from "../src/services/notificationService";

function RootLayoutNav() {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const params = useLocalSearchParams();
  const segmentKey = segments[0] ?? '';

  const handleNavigation = useCallback(() => {
    if (loading) return;

    const inAuthGroup  = segmentKey === "(auth)";
    const inUserGroup  = segmentKey === "(user)";
    const inOwnerGroup = segmentKey === "(owner)";
    const inAdminGroup = segmentKey === "(admin)";

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/welcome");
      return;
    }

    if (!profile) return;

    if (profile.role === "admin" && !inAdminGroup) {
      router.replace("/(admin)" as any);
    } else if (profile.role === "owner" && !inOwnerGroup) {
      const targetRole = Array.isArray(params.role) ? params.role[0] : params.role;
      if (inAuthGroup && targetRole === 'user') return; 
      router.replace("/(owner)" as any);
    } else if (profile.role === "user" && !inUserGroup) {
      const targetRole = Array.isArray(params.role) ? params.role[0] : params.role;
      if (inAuthGroup && targetRole === 'owner') return;
      router.replace("/(user)" as any);
    }
  }, [user, profile, loading, segmentKey, router]);

  useEffect(() => {
    handleNavigation();
  }, [handleNavigation]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#00AA13" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(user)" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(admin)" />
      </Stack>
      <NotificationToast ref={(ref) => {
        if (ref) {
          setGlobalNotificationRef({ current: ref } as any);
        }
      }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RootLayoutNav />
      </NotificationProvider>
    </AuthProvider>
  );
}
