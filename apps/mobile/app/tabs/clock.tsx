import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DARK as T } from '../../src/components/ui';

/**
 * Clock in/out is not yet available — the backend attendance API hasn't
 * shipped. Showing a placeholder here rather than calling /api/attendance/*
 * so this screen never depends on backend deploy status, and the rest of
 * the app (timesheet, leave, tasks, expenses) can be tested independently.
 *
 * To bring this back: restore the previous version of this file (clock
 * in/out UI + live timer) once POST/GET /api/attendance/* is deployed —
 * see worker src/modules/attendance/routes.ts.
 */
export default function ClockScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🕐</Text>
        <Text style={{ color: T.text, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
          Clock In/Out — Coming Soon
        </Text>
        <Text style={{ color: T.dim, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Daily attendance tracking isn't available yet. Use the Timesheet tab to log your hours in the meantime.
        </Text>
      </View>
    </SafeAreaView>
  );
}
