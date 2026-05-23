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
  const toastRef = useRef<NotificationToastRef>(null!);

  // Register the toast ref into the service so it can be called from anywhere
  useEffect(() => {
    if (toastRef.current) {
      setGlobalNotificationRef(toastRef);
    }
  }, []);

  // Use a string key derived from segments to avoid infinite re-render from
  // useSegments() returning a new array reference on every render.
  const segmentKey = segments[0] ?? '';

  const handleNavigation = useCallback(() => {
    if (loading) return;

    const inAuthGroup  = segmentKey === "(auth)";
    const inUserGroup  = segmentKey === "(user)";
    const inOwnerGroup = segmentKey === "(owner)";
    const inAdminGroup = segmentKey === "(admin)";

    if (!user) {
      // Not logged in — redirect to welcome if not already there
      if (!inAuthGroup) router.replace("/(auth)/welcome");
      return;
    }

    // Logged in but profile not yet loaded — wait
    if (!profile) return;

    if (profile.role === "admin" && !inAdminGroup) {
      router.replace("/(admin)" as any);
    } else if (profile.role === "owner" && !inOwnerGroup) {
      // Don't redirect if we're in auth and there's a mismatch (let login.tsx handle alert)
      const targetRole = Array.isArray(params.role) ? params.role[0] : params.role;
      if (inAuthGroup && targetRole === 'user') return; 
      
      router.replace("/(owner)" as any);
    } else if (profile.role === "user" && !inUserGroup) {
      // Don't redirect if we're in auth and there's a mismatch
      const targetRole = Array.isArray(params.role) ? params.role[0] : params.role;
      if (inAuthGroup && targetRole === 'owner') return;

      router.replace("/(user)" as any);
    }
    // Already in correct group → do nothing
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
      <NotificationToast ref={toastRef} />
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
