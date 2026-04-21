import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotificationPermissions } from '../utils/notifications';

const { width } = Dimensions.get('window');

const C = {
  bg: '#0D0F14',
  surface: '#161A22',
  border: '#252B36',
  accent: '#3B82F6',
  text: '#F0F4FF',
  muted: '#6B7589',
  white: '#FFFFFF',
};

const SLIDES = [
  {
    icon: '📷',
    title: 'Prends une photo',
    description: 'Scanne n\'importe quel document en quelques secondes. Ordonnances, factures, courriers — tout y passe.',
    color: '#3B82F6',
    bg: '#1E3A5F',
  },
  {
    icon: '✨',
    title: 'L\'IA s\'occupe du reste',
    description: 'Tes documents sont automatiquement organisés par catégorie et datés. Zéro effort de ta part.',
    color: '#F59E0B',
    bg: '#2D1F00',
  },
  {
    icon: '🔍',
    title: 'Retrouve-les en 3 secondes',
    description: 'Médical, financier, administratif — chaque document est rangé et accessible quand tu en as besoin.',
    color: '#10B981',
    bg: '#052E1C',
  },
  {
    icon: '🔔',
    title: 'Ne rate plus rien',
    description: 'Paiements, rendez-vous, convocations — l\'IA détecte tes échéances et t\'envoie un rappel automatique au bon moment.',
    color: '#8B5CF6',
    bg: '#2E1065',
    notifCta: true,
  },
  {
    icon: '🚀',
    title: 'C\'est parti !',
    description: 'Lance ton premier scan maintenant.',
    color: '#10B981',
    bg: '#052E1C',
    isLast: true,
  },
];

export const ONBOARDING_KEY = 'onepapier_onboarding_done';

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [notifGranted, setNotifGranted] = useState(false);
  const flatRef = useRef(null);

  const goTo = (i) => {
    flatRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  };

  const finish = async (goToCamera = false) => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    if (goToCamera) {
      navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Camera' }] });
    } else {
      navigation.replace('Home');
    }
  };

  const handleActivateNotifs = async () => {
    const granted = await requestNotificationPermissions();
    setNotifGranted(granted);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.iconWrap, { backgroundColor: item.bg, borderColor: item.color + '50' }]}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>

            {item.notifCta && (
              <TouchableOpacity
                style={[styles.notifBtn, { backgroundColor: item.color }, notifGranted && styles.notifBtnDone]}
                onPress={handleActivateNotifs}
                disabled={notifGranted}
                activeOpacity={0.85}
              >
                <Text style={styles.notifBtnText}>
                  {notifGranted ? '✓ Rappels activés' : '🔔 Activer les rappels'}
                </Text>
              </TouchableOpacity>
            )}

            {item.isLast && (
              <View style={styles.lastCtas}>
                <TouchableOpacity style={styles.scanBtn} onPress={() => finish(true)} activeOpacity={0.85}>
                  <Text style={styles.scanBtnText}>Scanner un document</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipBtn} onPress={() => finish(false)} activeOpacity={0.75}>
                  <Text style={styles.skipBtnText}>Pas maintenant</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      {/* Flèches de navigation centrées verticalement */}
      <View style={styles.arrowsOverlay} pointerEvents="box-none">
        {index > 0
          ? <TouchableOpacity style={styles.arrow} onPress={() => goTo(index - 1)} activeOpacity={0.8}>
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
          : <View style={styles.arrowPlaceholder} />
        }
        <View style={{ flex: 1 }} />
        {index < SLIDES.length - 1
          ? <TouchableOpacity style={styles.arrow} onPress={() => goTo(index + 1)} activeOpacity={0.8}>
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          : <View style={styles.arrowPlaceholder} />
        }
      </View>

      {/* Dots */}
      <View style={[styles.dots, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { width: i === index ? 24 : 8, opacity: i === index ? 1 : 0.4 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 64,
    paddingBottom: 80,
  },
  iconWrap: {
    width: 110, height: 110, borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 40,
    elevation: 8,
  },
  iconText: { fontSize: 52 },
  title: {
    fontSize: 28, fontWeight: '800', color: C.text,
    textAlign: 'center', marginBottom: 16, lineHeight: 34,
  },
  description: {
    fontSize: 16, color: C.muted, textAlign: 'center', lineHeight: 24,
  },

  notifBtn: {
    marginTop: 28, width: '100%',
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center',
  },
  notifBtnDone: { backgroundColor: '#16A34A' },
  notifBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  lastCtas: { marginTop: 28, width: '100%', gap: 12 },
  scanBtn: {
    height: 54, backgroundColor: '#10B981', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  scanBtnText: { fontSize: 16, fontWeight: '700', color: C.white },
  skipBtn: {
    height: 48, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtnText: { fontSize: 15, fontWeight: '600', color: C.muted },

  arrowsOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  arrow: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowText: { fontSize: 26, color: C.text, lineHeight: 30 },
  arrowPlaceholder: { width: 44 },

  dots: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6,
  },
  dot: { height: 8, borderRadius: 4, backgroundColor: C.accent },
});
