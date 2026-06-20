import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ViewStyle, TextStyle, KeyboardTypeOptions, TextInput as RNTextInput } from 'react-native';
import type { NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';
import { useAuthStore } from '../store/auth';

// ── Theme ─────────────────────────────────────────────────────────────────────
export const DARK = {
  bg:       '#020617', surface: '#0B1120', elevated: '#111827', card: '#0F172A',
  border:   '#1E293B', text: '#F1F5F9',   muted: '#94A3B8',    dim: '#475569',
  primary:  '#6366F1', success: '#10B981', warning: '#F59E0B', danger: '#EF4444',
};
export const LIGHT = {
  bg:       '#F8FAFC', surface: '#FFFFFF', elevated: '#F1F5F9', card: '#FFFFFF',
  border:   '#E2E8F0', text: '#0F172A',   muted: '#475569',    dim: '#94A3B8',
  primary:  '#6366F1', success: '#059669', warning: '#D97706', danger: '#DC2626',
};

export function useTheme() {
  // Could hook into a theme store — for now derive from tenant primary or default dark
  return DARK;
}

// ── Reusable components ───────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const T = useTheme();
  return (
    <View style={[{ backgroundColor: T.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: T.border }, style]}>
      {children}
    </View>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{label.replace(/_/g, ' ').toUpperCase()}</Text>
    </View>
  );
}

export function BigButton({
  label, onPress, color, disabled, loading, style,
}: {
  label: string; onPress: () => void; color?: string;
  disabled?: boolean; loading?: boolean; style?: ViewStyle;
}) {
  const T   = useTheme();
  const bg  = color ?? T.primary;
  const opc = disabled || loading ? 0.5 : 1;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[{
        backgroundColor: bg, borderRadius: 14, paddingVertical: 16,
        alignItems: 'center', opacity: opc,
        shadowColor: bg, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
      }, style]}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

export function Input({
  value, onChange, placeholder, secureTextEntry, keyboardType, autoCapitalize, style,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: TextStyle;
}) {
  const T = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={T.dim}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'none'}
      style={[{
        backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border,
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        color: T.text, fontSize: 15,
      }, style]}
    />
  );
}

export function SectionTitle({ children }: { children: string }) {
  const T = useTheme();
  return <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>{children}</Text>;
}

export function Divider() {
  const T = useTheme();
  return <View style={{ height: 1, backgroundColor: T.border, marginVertical: 12 }} />;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={{ backgroundColor: '#EF444422', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

export function SuccessBox({ message }: { message: string }) {
  return (
    <View style={{ backgroundColor: '#10B98122', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: '#10B981', fontSize: 13, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

export function MetricTile({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon?: string }) {
  const T = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: T.elevated, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
      {icon && <Text style={{ fontSize: 22, marginBottom: 4 }}>{icon}</Text>}
      <Text style={{ fontSize: 22, fontWeight: '900', color: color ?? T.primary }}>{value}</Text>
      <Text style={{ fontSize: 10, color: T.dim, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}
