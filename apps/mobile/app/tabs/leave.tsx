import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../src/store/auth';
import { DARK as T } from '../../src/components/ui';

type Balance = { id: string; leave_type: string; entitlement: number; used: number; remaining: number };

const LEAVE_TYPES = [
  { key: 'annual',        icon: '🌴', label: 'Annual' },
  { key: 'sick',          icon: '🤒', label: 'Sick' },
  { key: 'compassionate', icon: '💙', label: 'Compassionate' },
  { key: 'unpaid',        icon: '⏸️', label: 'Unpaid' },
  { key: 'other',         icon: '📅', label: 'Other' },
];

const today = () => new Date().toISOString().split('T')[0];

export default function LeaveScreen() {
  const [balances, setBalances]     = useState<Balance[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [saving,   setSaving]       = useState(false);
  const [form, setForm]             = useState({ leaveType: 'annual', startDate: today(), endDate: today(), reason: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    apiFetch<Balance[]>('/api/leave/balances/my')
      .then(data => setBalances(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const days = Math.max(1, Math.ceil(
        (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000
      ) + 1);
      await apiFetch('/api/leave', {
        method: 'POST',
        body: JSON.stringify({ ...form, days }),
      });
      setSubmitted(true);
      setShowForm(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        <Text style={{ color: T.text, fontSize: 22, fontWeight: '900', marginBottom: 20 }}>Leave</Text>

        {submitted && (
          <View style={{ backgroundColor: T.success + '22', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: T.success, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
              ✅ Request submitted — awaiting manager approval
            </Text>
          </View>
        )}

        {/* Balances grid */}
        <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
          Your balances
        </Text>
        {balances.length === 0 ? (
          <View style={{ backgroundColor: T.elevated, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ color: T.dim, fontSize: 14 }}>No leave balances set up yet</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {balances.map(b => {
              const icon = LEAVE_TYPES.find(t => t.key === b.leave_type)?.icon ?? '📅';
              const color = b.remaining > 5 ? T.success : b.remaining > 0 ? T.warning : T.danger;
              return (
                <View key={b.id} style={{
                  width: '47%', backgroundColor: T.card, borderRadius: 14, padding: 16,
                  borderWidth: 1, borderColor: T.border,
                }}>
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>{icon}</Text>
                  <Text style={{ color, fontSize: 28, fontWeight: '900' }}>{b.remaining}d</Text>
                  <Text style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>
                    {b.leave_type.replace(/_/g, ' ')} remaining
                  </Text>
                  <Text style={{ color: T.dim, fontSize: 10 }}>of {b.entitlement}d</Text>
                  {/* Usage bar */}
                  <View style={{ backgroundColor: T.border, borderRadius: 99, height: 4, marginTop: 8 }}>
                    <View style={{ width: `${Math.round((b.used / b.entitlement) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Request form */}
        {!showForm ? (
          <TouchableOpacity onPress={() => setShowForm(true)} activeOpacity={0.85}
            style={{ backgroundColor: T.primary, borderRadius: 16, padding: 18, alignItems: 'center', shadowColor: T.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>+ Request Leave</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ backgroundColor: T.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', marginBottom: 16 }}>New Request</Text>

            {/* Type pills */}
            <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {LEAVE_TYPES.map(t => (
                  <TouchableOpacity key={t.key} onPress={() => set('leaveType', t.key)} activeOpacity={0.7}
                    style={{ backgroundColor: form.leaveType === t.key ? T.primary + '22' : T.elevated, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: form.leaveType === t.key ? T.primary : T.border }}>
                    <Text style={{ fontSize: 18 }}>{t.icon}</Text>
                    <Text style={{ color: form.leaveType === t.key ? T.primary : T.muted, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Dates */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>From</Text>
                <TextInput value={form.startDate} onChangeText={v => set('startDate', v)} placeholder="YYYY-MM-DD"
                  placeholderTextColor={T.dim} style={{ backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, color: T.text, fontSize: 14 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>To</Text>
                <TextInput value={form.endDate} onChangeText={v => set('endDate', v)} placeholder="YYYY-MM-DD"
                  placeholderTextColor={T.dim} style={{ backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, color: T.text, fontSize: 14 }} />
              </View>
            </View>

            <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>Reason (optional)</Text>
            <TextInput value={form.reason} onChangeText={v => set('reason', v)} multiline numberOfLines={2}
              placeholder="e.g. Family holiday"
              placeholderTextColor={T.dim}
              style={{ backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, color: T.text, fontSize: 14, marginBottom: 16 }} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setShowForm(false)} style={{ flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: T.muted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={saving} activeOpacity={0.85}
                style={{ flex: 2, backgroundColor: T.primary, borderRadius: 12, padding: 14, alignItems: 'center', opacity: saving ? 0.7 : 1 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{saving ? 'Submitting...' : 'Submit Request'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
