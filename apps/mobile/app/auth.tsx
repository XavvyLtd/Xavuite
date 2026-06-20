import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore, resolveTenant, apiFetch } from '../src/store/auth';
import { DARK as T } from '../src/components/ui';

type Step = 'email' | 'password' | 'magic-sent';

export default function AuthScreen() {
  const { setTenant, setTokens, setUser, tenant } = useAuthStore();
  const [step,     setStep]     = useState<Step>('email');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const primaryColor = tenant?.primaryColor ?? T.primary;

  // Step 1: Resolve tenant from email
  const handleEmailNext = async () => {
    if (!email.includes('@')) { setError('Enter a valid work email'); return; }
    setLoading(true); setError('');
    try {
      const config = await resolveTenant(email);
      setTenant(config);
      setStep('password');
    } catch (e: any) {
      setError(e.message ?? 'Could not find your organisation');
    } finally { setLoading(false); }
  };

  // Step 2: Login with password
  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const data: any = await apiFetch('/api/auth/login', {
        method:  'POST',
        body:    JSON.stringify({ email, password }),
      });
      await setTokens(data.accessToken, data.refreshToken);
      // Fetch user profile
      const me: any = await apiFetch('/api/me');
      setUser(me.user);
      router.replace('/tabs/clock');
    } catch (e: any) {
      setError(e.message ?? 'Login failed — check your password');
    } finally { setLoading(false); }
  };

  // Magic link
  const handleMagicLink = async () => {
    setLoading(true); setError('');
    try {
      await apiFetch('/api/auth/magic-link', {
        method: 'POST',
        body:   JSON.stringify({ email }),
      });
      setStep('magic-sent');
    } catch (e: any) {
      setError(e.message ?? 'Failed to send link');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Brand */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          {tenant?.logoUrl ? (
            <Image source={{ uri: tenant.logoUrl }} style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 16 }} />
          ) : (
            <View style={{
              width: 64, height: 64, borderRadius: 20, marginBottom: 16,
              backgroundColor: primaryColor,
              justifyContent: 'center', alignItems: 'center',
              shadowColor: primaryColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
            }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>
                {(tenant?.tenantName ?? 'X')[0]}
              </Text>
            </View>
          )}
          <Text style={{ color: T.text, fontSize: 24, fontWeight: '900', marginBottom: 4 }}>
            {tenant?.tenantName ?? 'XavvySuite'}
          </Text>
          <Text style={{ color: T.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700' }}>
            Workforce Platform
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={{ backgroundColor: T.danger + '22', borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <Text style={{ color: T.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text>
          </View>
        ) : null}

        {/* Step: email */}
        {step === 'email' && (
          <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
              Work email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={T.dim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={handleEmailNext}
              style={{ backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, color: T.text, fontSize: 16, marginBottom: 16 }}
            />
            <TouchableOpacity
              onPress={handleEmailNext}
              disabled={loading || !email}
              activeOpacity={0.8}
              style={{ backgroundColor: primaryColor, borderRadius: 14, padding: 16, alignItems: 'center', opacity: loading || !email ? 0.5 : 1 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Continue →</Text>
              }
            </TouchableOpacity>
            <Text style={{ color: T.dim, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
              We'll find your organisation from your email
            </Text>
          </View>
        )}

        {/* Step: password */}
        {step === 'password' && (
          <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: T.border }}>
            <View style={{ backgroundColor: T.elevated, borderRadius: 10, padding: 10, marginBottom: 20 }}>
              <Text style={{ color: T.muted, fontSize: 12 }}>Signing in as</Text>
              <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{email}</Text>
              <TouchableOpacity onPress={() => { setStep('email'); setError(''); }}>
                <Text style={{ color: primaryColor, fontSize: 12, marginTop: 2 }}>Change →</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: T.dim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={T.dim}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              style={{ backgroundColor: T.elevated, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, color: T.text, fontSize: 16, marginBottom: 16 }}
            />

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading || !password}
              activeOpacity={0.8}
              style={{ backgroundColor: primaryColor, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12, opacity: loading || !password ? 0.5 : 1 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Sign In →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={handleMagicLink} disabled={loading} activeOpacity={0.7}
              style={{ borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: T.muted, fontSize: 14, fontWeight: '600' }}>📧 Send magic link instead</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step: magic link sent */}
        {step === 'magic-sent' && (
          <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>📧</Text>
            <Text style={{ color: T.text, fontSize: 20, fontWeight: '900', marginBottom: 8 }}>Check your email</Text>
            <Text style={{ color: T.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              We've sent a sign-in link to{'\n'}
              <Text style={{ color: T.text, fontWeight: '700' }}>{email}</Text>
              {'\n\n'}Tap the link in your email to sign in. Expires in 15 minutes.
            </Text>
            <TouchableOpacity onPress={() => { setStep('password'); setError(''); }} style={{ marginTop: 24 }}>
              <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '700' }}>← Use password instead</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
