import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../src/store/auth';
import { DARK as T } from '../../src/components/ui';

type Task = {
  id: string; name: string; status: string; priority: string;
  due_date: string | null; project_name: string | null;
  estimated_hours: number | null; phase: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  in_progress: T.warning, todo: T.muted, backlog: T.dim,
  done: T.success, blocked: T.danger,
};
const PRIORITY_COLOR: Record<string, string> = {
  critical: '#FF4444', high: T.danger, medium: T.warning, low: T.muted,
};

export default function TasksScreen() {
  const [tasks,     setTasks]     = useState<Task[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [filter,    setFilter]    = useState<'all' | 'today' | 'overdue'>('all');
  const today = new Date().toISOString().split('T')[0];

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await apiFetch<Task[]>('/api/pmo/tasks?mine=true');
      setTasks(Array.isArray(data) ? data : []);
    } catch { setTasks([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const open    = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const overdue = open.filter(t => t.due_date && t.due_date < today);
  const dueToday= open.filter(t => t.due_date === today);

  const filtered = filter === 'overdue' ? overdue : filter === 'today' ? dueToday : open;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: T.muted }}>Loading tasks...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.primary} />}
      >
        <Text style={{ color: T.text, fontSize: 22, fontWeight: '900', marginBottom: 6 }}>My Tasks</Text>
        <Text style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
          {open.length} open · {overdue.length} overdue · {dueToday.length} due today
        </Text>

        {/* Filter pills */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {([['all', `All (${open.length})`], ['today', `Today (${dueToday.length})`], ['overdue', `Overdue (${overdue.length})`]] as const).map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setFilter(k)} activeOpacity={0.7}
              style={{ backgroundColor: filter === k ? T.primary : T.elevated, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: filter === k ? T.primary : T.border }}>
              <Text style={{ color: filter === k ? '#fff' : T.muted, fontSize: 12, fontWeight: '700' }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
            <Text style={{ color: T.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>All clear!</Text>
            <Text style={{ color: T.dim, fontSize: 13 }}>No {filter === 'overdue' ? 'overdue' : filter === 'today' ? "today's" : 'open'} tasks</Text>
          </View>
        )}

        {filtered.map(t => {
          const isOverdue = t.due_date && t.due_date < today && t.status !== 'done';
          const isDueToday= t.due_date === today;
          return (
            <View key={t.id} style={{
              backgroundColor: T.card, borderRadius: 14, padding: 16, marginBottom: 10,
              borderWidth: 1, borderColor: isOverdue ? T.danger + '44' : T.border,
              borderLeftWidth: 4, borderLeftColor: STATUS_COLOR[t.status] ?? T.muted,
            }}>
              {/* Priority + status */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <View style={{ backgroundColor: (PRIORITY_COLOR[t.priority] ?? T.muted) + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: PRIORITY_COLOR[t.priority] ?? T.muted, fontSize: 10, fontWeight: '700' }}>
                    {t.priority?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ backgroundColor: (STATUS_COLOR[t.status] ?? T.muted) + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: STATUS_COLOR[t.status] ?? T.muted, fontSize: 10, fontWeight: '700' }}>
                    {t.status?.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Task name */}
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>{t.name}</Text>

              {/* Meta */}
              <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                {t.project_name && (
                  <Text style={{ color: T.dim, fontSize: 12 }}>📂 {t.project_name}</Text>
                )}
                {t.phase && (
                  <Text style={{ color: T.dim, fontSize: 12 }}>🏃 {t.phase}</Text>
                )}
                {t.due_date && (
                  <Text style={{ color: isOverdue ? T.danger : isDueToday ? T.warning : T.dim, fontSize: 12, fontWeight: isOverdue || isDueToday ? '700' : '400' }}>
                    {isOverdue ? '⚠️ Overdue: ' : isDueToday ? '⏰ Due today: ' : '📅 Due: '}{t.due_date}
                  </Text>
                )}
                {t.estimated_hours && (
                  <Text style={{ color: T.dim, fontSize: 12 }}>⏱ {t.estimated_hours}h est.</Text>
                )}
              </View>
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}
