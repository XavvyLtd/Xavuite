import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../src/store/auth';
import { DARK as T } from '../../src/components/ui';

type Entry = { date: string; hours: string; description: string; projectId: string };
type Project = { id: string; name: string; colour: string };

const getMondayOf = (d = new Date()) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m.toISOString().split('T')[0];
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function TimesheetScreen() {
  const monday = getMondayOf();
  const today  = new Date().toISOString().split('T')[0];

  const [entries, setEntries] = useState<Entry[]>(() =>
    Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().split('T')[0], hours: '', description: '', projectId: '' };
    })
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    apiFetch<any>('/api/pmo/projects?status=active')
      .then((data: any) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const setEntry = (i: number, k: keyof Entry, v: string) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const totalHours = entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);

  const handleSubmit = async () => {
    const filled = entries.filter(e => parseFloat(e.hours) > 0);
    if (!filled.length) { Alert.alert('No hours', 'Enter hours for at least one day'); return; }
    setSaving(true);
    try {
      await apiFetch('/api/timesheets', {
        method: 'POST',
        body: JSON.stringify({
          weekStarting: monday,
          entries: filled.map(e => ({
            date: e.date, hoursWorked: parseFloat(e.hours),
            description: e.description || 'Work',
            billable: true, projectId: e.projectId || null,
          })),
        }),
      });
      setSaved(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Submission failed');
    } finally { setSaving(false); }
  };

  if (saved) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 72, marginBottom: 20 }}>✅</Text>
        <Text style={{ color: T.text, fontSize: 24, fontWeight: '900', marginBottom: 8 }}>Submitted!</Text>
        <Text style={{ color: T.muted, fontSize: 15, marginBottom: 32 }}>{totalHours}h logged for this week</Text>
        <TouchableOpacity onPress={() => setSaved(false)} activeOpacity={0.8}
          style={{ backgroundColor: T.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

          <Text style={{ color: T.muted, fontSize: 12, marginBottom: 4 }}>Week of {monday}</Text>
          <Text style={{ color: T.text, fontSize: 22, fontWeight: '900', marginBottom: 6 }}>Log Timesheet</Text>
          <Text style={{ color: T.success, fontSize: 14, fontWeight: '700', marginBottom: 24 }}>
            {totalHours > 0 ? `${totalHours}h logged` : 'Enter hours for each day'}
          </Text>

          {/* Quick fill */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[7.5, 8].map(h => (
              <TouchableOpacity key={h} onPress={() => setEntries(prev => prev.map(e => ({ ...e, hours: String(h) })))}
                style={{ flex: 1, backgroundColor: T.elevated, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                <Text style={{ color: T.muted, fontWeight: '700', fontSize: 13 }}>Fill {h}h/day</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setEntries(prev => prev.map(e => ({ ...e, hours: '' })))}
              style={{ backgroundColor: T.elevated, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border, paddingHorizontal: 16 }}>
              <Text style={{ color: T.dim, fontSize: 13 }}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Daily entries */}
          {entries.map((e, i) => {
            const isToday = e.date === today;
            const hasHours = parseFloat(e.hours) > 0;
            return (
              <View key={e.date} style={{
                backgroundColor: isToday ? T.primary + '11' : T.elevated,
                borderRadius: 14, padding: 14, marginBottom: 10,
                borderWidth: 1, borderColor: isToday ? T.primary + '44' : T.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 48, alignItems: 'center' }}>
                    <Text style={{ color: isToday ? T.primary : T.dim, fontSize: 11, fontWeight: '700' }}>{DAYS[i]}</Text>
                    <Text style={{ color: isToday ? T.primary : T.text, fontSize: 20, fontWeight: '900' }}>
                      {new Date(e.date).getDate()}
                    </Text>
                  </View>
                  <TextInput
                    value={e.hours}
                    onChangeText={v => setEntry(i, 'hours', v)}
                    placeholder="0"
                    placeholderTextColor={T.dim}
                    keyboardType="decimal-pad"
                    style={{
                      flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
                      borderRadius: 10, padding: 12, color: T.text,
                      fontSize: 28, fontWeight: '900', textAlign: 'center',
                    }}
                  />
                  <Text style={{ color: T.muted, fontSize: 16, fontWeight: '700', width: 16 }}>h</Text>
                </View>
                {hasHours && (
                  <TextInput
                    value={e.description}
                    onChangeText={v => setEntry(i, 'description', v)}
                    placeholder="What did you work on?"
                    placeholderTextColor={T.dim}
                    style={{
                      marginTop: 10, backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
                      borderRadius: 10, padding: 10, color: T.text, fontSize: 13,
                    }}
                  />
                )}
              </View>
            );
          })}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={saving || totalHours === 0}
            activeOpacity={0.85}
            style={{
              backgroundColor: totalHours > 0 ? T.primary : T.elevated,
              borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 8,
              opacity: totalHours === 0 ? 0.5 : 1,
              shadowColor: T.primary, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: totalHours > 0 ? 0.3 : 0, shadowRadius: 12, elevation: 6,
            }}
          >
            <Text style={{ color: totalHours > 0 ? '#fff' : T.dim, fontSize: 17, fontWeight: '900' }}>
              {saving ? 'Submitting...' : totalHours > 0 ? `Submit ${totalHours}h` : 'Enter some hours first'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
