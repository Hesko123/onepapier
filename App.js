import { useEffect, useState } from 'react';
import { Platform, Linking, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Purchases from 'react-native-purchases';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import SaveDocumentScreen from './src/screens/SaveDocumentScreen';
import FolderScreen from './src/screens/FolderScreen';
import DocumentScreen from './src/screens/DocumentScreen';
import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/OnboardingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { REVENUECAT_API_KEY_ANDROID } from './src/config.js';
import { requestNotificationPermissions } from './src/utils/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();
const PACKAGE_ID = 'com.jobswipestudio.onepapier';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`;

function isNewer(latest, current) {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

async function fetchPlayStoreVersion() {
  const res = await fetch(
    `https://play.google.com/store/apps/details?id=${PACKAGE_ID}&hl=en&gl=US`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
  );
  const html = await res.text();

  const patterns = [
    /"softwareVersion"\s*:\s*"([^"]+)"/,
    /\[\[\["(\d+\.\d+[.\d]*)"\]\],null/,
    /\[\[\["(\d+\.\d+[.\d]*)"\]\]\]/,
    /Current Version[^>]*>([0-9]+\.[0-9]+[.0-9]*)/,
    /"(\d+\.\d+[.\d]*)"\s*,\s*\[\[\[/,
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const apiKey = Platform.OS === 'android' ? REVENUECAT_API_KEY_ANDROID : null;
    if (apiKey) Purchases.configure({ apiKey });

    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setInitialRoute(val ? 'Home' : 'Onboarding');
    });

    if (Platform.OS === 'android') {
      const current = require('./app.json').expo?.version ?? '0.0.0';
      fetchPlayStoreVersion()
        .then(latest => {
          if (latest && isNewer(latest, current)) setShowUpdate(true);
        })
        .catch(() => {});
    }
  }, []);

  if (!initialRoute) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Camera" component={CameraScreen} />
          <Stack.Screen name="SaveDocument" component={SaveDocumentScreen} />
          <Stack.Screen name="Folder" component={FolderScreen} />
          <Stack.Screen name="Document" component={DocumentScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      <Modal visible={showUpdate} transparent animationType="fade" statusBarTranslucent>
        <View style={s.overlay}>
          <View style={s.card}>
            <Text style={s.title}>Mise à jour disponible</Text>
            <Text style={s.body}>
              Une nouvelle version de OnePapier est disponible sur le Play Store.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowUpdate(false);
                Linking.openURL(PLAY_STORE_URL);
              }}
              activeOpacity={0.7}
            >
              <Text style={s.btn}>Ok</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  card: {
    width: '100%', backgroundColor: '#1A1F2E',
    borderRadius: 16, borderWidth: 1, borderColor: '#252B36',
    padding: 20, gap: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#F0F4FF' },
  body: { fontSize: 14, color: '#6B7589', lineHeight: 21 },
  btn: {
    fontSize: 15, fontWeight: '700', color: '#3B82F6',
    textAlign: 'right', paddingTop: 4,
  },
});
