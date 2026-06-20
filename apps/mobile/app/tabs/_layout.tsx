import { Tabs } from 'expo-router';
import { Text } from 'react-native';

// Inlined theme constants — no external imports needed here
const T = {
  surface: '#0B1120',
  border:  '#1E293B',
  primary: '#6366F1',
  dim:     '#475569',
};

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{icon}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: T.surface,
          borderTopColor:  T.border,
          borderTopWidth:  1,
          paddingBottom:   4,
          height:          60,
        },
        tabBarActiveTintColor:   T.primary,
        tabBarInactiveTintColor: T.dim,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="clock"   options={{ title: 'Clock',     tabBarIcon: ({ focused }) => <TabIcon icon="🕐" focused={focused} /> }} />
      <Tabs.Screen name="time"    options={{ title: 'Timesheet', tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} /> }} />
      <Tabs.Screen name="leave"   options={{ title: 'Leave',     tabBarIcon: ({ focused }) => <TabIcon icon="🌴" focused={focused} /> }} />
      <Tabs.Screen name="tasks"   options={{ title: 'Tasks',     tabBarIcon: ({ focused }) => <TabIcon icon="✅" focused={focused} /> }} />
      <Tabs.Screen name="expense" options={{ title: 'Expenses',  tabBarIcon: ({ focused }) => <TabIcon icon="💷" focused={focused} /> }} />
      <Tabs.Screen name="more"    options={{ title: 'More',      tabBarIcon: ({ focused }) => <TabIcon icon="⋯"  focused={focused} /> }} />
    </Tabs>
  );
}
