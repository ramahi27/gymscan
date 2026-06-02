import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/constants/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: "rgba(255,255,255,0.5)",
        tabBarStyle: {
          backgroundColor: "#0A0A0A",
          borderTopColor: COLORS.border,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "HOME",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "SCAN",
          tabBarIcon: ({ color, size }) => <Ionicons name="scan" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "MY PLAN",
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFILE",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
