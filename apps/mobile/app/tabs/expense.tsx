import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../../src/store/auth';
import { DARK as T } from '../../src/components/ui';

const CATEGORIES = [
  { k: 'travel',        l: '🚗 Travel'    },
  { k: 'meals',         l: '🍽️ Meals'     },
  { k: 'accommodation', l: '🏨 Hotel'     },
  { k: 'equipment',     l: '💻 Equipment' },
  { k: 'training',      l: '🎓 Training'  },
  { k: 'other',         l: '📦 Other'     },
];

const today = () => new Date().toISOString().split('T')[0];

export default function ExpenseScreen() {
  const [form, setForm] = useState({ amount: '', category: 'travel', description: '', date: today() });
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const pickReceipt = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is needed to capture receipts');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setReceipt(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setReceipt(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!form.amount || !form.description) {
      Alert.alert('Missing info', 'Please enter amount and description');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      // TODO: if receipt, upload to /api/expenses/:id/receipt
      setSaved(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit');
    } finally { setSaving(false); }
  };

  if (saved) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 72, marginBottom: 20 }}>💷</Text>
        <Text style={{ color: T.text, fontSize: 24, fontWeight: '900', marginBottom: 8 }}>Expense submitted!</Text>
        <Text style={{ color: T.muted, fontSize: 15, marginBottom: 32 }}>£{parseFloat(form.amount || '0').toFixed(2)} awaiting approval</Text>
        <TouchableOpacity onPress={() => { setSaved(false); setForm({ amount: '', category: 'travel', description: '', date: today() }); setReceipt(null); }}
          activeOpacity={0.8} style={{ backgroundColor: T.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Log another</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        <Text style={{ color: T.text, fontSize: 22, fontWeight: '900', marginBottom: 24 }}>Quick Expense</Text>

        {/* Amount — big input */}
        <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: T.border }}>
          <Text style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>Amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: T.muted, fontSize: 32, fontWeight: '900' }}>£</Text>
            <TextInput
              value={form.amount}
              onChangeText={v => set('amount', v)}
              placeholder="0.00"
              placeholderTextColor={T.dim}
              keyboardType="decimal-pad"
              style={{ color: T.text, fontSize: 48, fontWeight: '900', minWidth: 120, textAlign: 'center' }}
            />
          </View>
        </View>

        {/* Category grid */}
        <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c.k} onPress={() => set('category', c.k)} activeOpacity={0.7}
              style={{ width: '31%', backgroundColor: form.category === c.k ? T.primary + '22' : T.elevated, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: form.category === c.k ? T.primary : T.border }}>
              <Text style={{ fontSize: 22, marginBottom: 4 }}>{c.l.split(' ')[0]}</Text>
              <Text style={{ color: form.category === c.k ? T.primary : T.muted, fontSize: 11, fontWeight: '700' }}>{c.l.split(' ').slice(1).join(' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Description</Text>
        <TextInput
          value={form.description}
          onChangeText={v => set('description', v)}
          placeholder="e.g. Client lunch at Café Nero"
          placeholderTextColor={T.dim}
          style={{ backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, color: T.text, fontSize: 15, marginBottom: 16 }}
        />

        {/* Receipt photo */}
        <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Receipt (optional)</Text>
        {receipt ? (
          <View style={{ marginBottom: 16 }}>
            <Image source={{ uri: receipt }} style={{ width: '100%', height: 160, borderRadius: 12, marginBottom: 8 }} resizeMode="cover" />
            <TouchableOpacity onPress={() => setReceipt(null)}>
              <Text style={{ color: T.danger, fontSize: 13, textAlign: 'center' }}>Remove photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            <TouchableOpacity onPress={pickReceipt} activeOpacity={0.7}
              style={{ flex: 1, backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, alignItems: 'center', borderStyle: 'dashed' }}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>📷</Text>
              <Text style={{ color: T.muted, fontSize: 12, fontWeight: '700' }}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickFromGallery} activeOpacity={0.7}
              style={{ flex: 1, backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, alignItems: 'center', borderStyle: 'dashed' }}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>🖼️</Text>
              <Text style={{ color: T.muted, fontSize: 12, fontWeight: '700' }}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={saving || !form.amount || !form.description}
          activeOpacity={0.85}
          style={{
            backgroundColor: form.amount && form.description ? T.primary : T.elevated,
            borderRadius: 16, padding: 18, alignItems: 'center',
            opacity: saving || !form.amount || !form.description ? 0.5 : 1,
            shadowColor: T.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
          }}
        >
          <Text style={{ color: form.amount && form.description ? '#fff' : T.dim, fontSize: 17, fontWeight: '900' }}>
            {saving ? 'Submitting...' : `Submit £${parseFloat(form.amount || '0').toFixed(2)} expense`}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
