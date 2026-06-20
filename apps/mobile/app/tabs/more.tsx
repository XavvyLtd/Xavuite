import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { apiFetch, useAuthStore } from '../../src/store/auth';
import { DARK as T } from '../../src/components/ui';

// See app/_layout.tsx for the full explanation: expo-notifications throws
// at IMPORT time when running in Expo Go (a module-level push-token listener
// triggers the throw), so it must never be statically imported here either.
// Same explicit flag as _layout.tsx — only set this true in a real dev
// client or production build, never Expo Go.
const NOTIFICATIONS_ENABLED = process.env.EXPO_PUBLIC_NOTIFICATIONS_ENABLED === 'true';

// Lazily required only when enabled, so the file never even loads otherwise.
const Notifications = NOTIFICATIONS_ENABLED ? require('expo-notifications') : null;

type Notif = { id: string; title: string; priority: string; created_at: string };

const PRIORITY_COLOR: Record<string, string> = {
  urgent: T.danger, high: T.warning, medium: T.primary, low: T.dim,
};

export default function MoreScreen() {
  const { user, logout, tenant } = useAuthStore();
  const [notifs,   setNotifs]   = useState<Notif[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    // Load notifications
    apiFetch<Notif[]>('/api/dashboard/notifications')
      .then(data => setNotifs(Array.isArray(data) ? data : []))
      .catch(() => {});

    // Check push permission — skipped entirely if notifications are disabled
    if (NOTIFICATIONS_ENABLED) {
      Notifications.getPermissionsAsync().then(({ status }: { status: string }) => setPushEnabled(status === 'granted'));
    }
  }, []);

  const enablePush = async () => {
    if (!NOTIFICATIONS_ENABLED) {
      Alert.alert(
        'Not available in this build',
        'Push notifications require a development build with notifications enabled. See app/_layout.tsx for how to turn this on.'
      );
      return;
    }

    // Android 8+ requires a notification channel before notifications display
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: T.primary,
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      setPushEnabled(true);
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const token = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        // Register push token with backend
        await apiFetch('/api/notifications/push-token', {
          method: 'POST',
          body: JSON.stringify({ token: token.data, platform: 'android' }),
        }).catch(() => {});
      } catch (e) {
        // Push token registration is best-effort — permission is still granted
        // even if we couldn't fetch/register a token (e.g. running in Expo Go
        // without a dev build, or offline).
        console.warn('Could not register push token:', e);
      }
    } else {
      Alert.alert('Permission denied', 'Enable notifications in your phone settings');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/auth');
      }},
    ]);
  };

  const name   = user?.email?.split('@')[0] ?? 'You';
  const initials = name.slice(0, 2).toUpperCase();
  const role   = user?.roles?.[0]?.replace(/_/g, ' ') ?? 'Employee';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        {/* Profile card */}
        <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: T.primary + '33', borderWidth: 2, borderColor: T.primary + '55', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: T.primary, fontSize: 18, fontWeight: '900' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>{name}</Text>
            <Text style={{ color: T.primary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{role}</Text>
            <Text style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>{tenant?.tenantName ?? 'XavvySuite'}</Text>
          </View>
        </View>

        {/* Notifications */}
        {notifs.length > 0 && (
          <>
            <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
              Notifications ({notifs.length})
            </Text>
            {notifs.slice(0, 5).map(n => (
              <View key={n.id} style={{
                backgroundColor: T.elevated, borderRadius: 12, padding: 14, marginBottom: 8,
                borderWidth: 1, borderColor: T.border,
                borderLeftWidth: 4, borderLeftColor: PRIORITY_COLOR[n.priority] ?? T.muted,
              }}>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{n.title}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <View style={{ backgroundColor: (PRIORITY_COLOR[n.priority] ?? T.muted) + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: PRIORITY_COLOR[n.priority] ?? T.muted, fontSize: 10, fontWeight: '700' }}>
                      {n.priority?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ color: T.dim, fontSize: 11 }}>
                    {new Date(n.created_at).toLocaleDateString('en-GB')}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {notifs.length === 0 && (
          <View style={{ backgroundColor: T.elevated, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🔔</Text>
            <Text style={{ color: T.dim, fontSize: 13 }}>No notifications</Text>
          </View>
        )}

        {/* Settings */}
        <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, marginTop: 8 }}>
          Settings
        </Text>

        {/* Push notifications toggle */}
        <View style={{ backgroundColor: T.elevated, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Push Notifications</Text>
            <Text style={{ color: T.dim, fontSize: 12, marginTop: 2 }}>Leave approvals, reminders</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={v => { if (v) enablePush(); else setPushEnabled(false); }}
            trackColor={{ false: T.border, true: T.primary + '88' }}
            thumbColor={pushEnabled ? T.primary : T.dim}
          />
        </View>

        {/* App info */}
        <View style={{ backgroundColor: T.elevated, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: T.muted, fontSize: 13 }}>Version</Text>
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>1.0.0</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: T.muted, fontSize: 13 }}>Organisation</Text>
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>{tenant?.tenantName ?? '—'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: T.muted, fontSize: 13 }}>API</Text>
            <Text style={{ color: T.dim, fontSize: 12 }}>{tenant?.apiBase ?? '—'}</Text>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}
          style={{ backgroundColor: T.danger + '22', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: T.danger + '44' }}>
          <Text style={{ color: T.danger, fontSize: 16, fontWeight: '800' }}>🚪 Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
