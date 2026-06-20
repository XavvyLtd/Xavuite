import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../src/store/auth';

SplashScreen.preventAutoHideAsync();

/**
 * expo-notifications registers module-level side effects the instant it's
 * imported (a push-token listener that calls warnOfExpoGoPushUsage(), which
 * THROWS on Android when running in Expo Go). That means a runtime check
 * after importing is too late — the crash happens at import time, before
 * any of our own code runs.
 *
 * The only fully reliable fix is to never import the module at all unless
 * we explicitly know we're in a real native build. We gate that behind one
 * env var you control directly, rather than relying on automatic Expo Go
 * detection (which can be unreliable depending on how the dev client / esp.
 * a stale dev-client APK was built).
 *
 * To enable notifications: set EXPO_PUBLIC_NOTIFICATIONS_ENABLED=true
 * before running `expo start` or in eas.json's build profile env block —
 * only do this when you're definitely running inside a proper dev client
 * or production build, never Expo Go.
 */
const NOTIFICATIONS_ENABLED = process.env.EXPO_PUBLIC_NOTIFICATIONS_ENABLED === 'true';

if (NOTIFICATIONS_ENABLED) {
  // require(), not import — this defers loading the module (and therefore
  // its risky top-level side effects) until this line actually executes,
  // which only happens when the flag is on.
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  false,
      shouldSetBadge:   true,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });
}

export default function RootLayout() {
  const { hydrate, isLoading } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  // Handle deep links: xavvysuite://login?tenant=...&server=...
  useEffect(() => {
    const handleUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      if (parsed.path === 'login' && parsed.queryParams?.tenant) {
        const config = {
          tenantId:     parsed.queryParams.tenant as string,
          tenantName:   parsed.queryParams.name as string ?? 'XavvySuite',
          apiBase:      parsed.queryParams.server as string ?? 'https://api-v2.xavvy.uk',
          primaryColor: parsed.queryParams.color as string ?? '#6366F1',
          logoUrl:      null,
        };
        try {
          await SecureStore.setItemAsync('xs_tenant', JSON.stringify(config));
        } catch { /* non-fatal */ }
        useAuthStore.getState().setTenant(config);
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Show spinner instead of blank white screen while hydrating
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="tabs" />
      </Stack>
    </GestureHandlerRootView>
  );
}
