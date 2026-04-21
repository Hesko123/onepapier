import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Linking, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { PRIVACY_URL, TERMS_URL } from '../config';
import { restorePurchases } from '../utils/purchases';

const PACKAGE_ID = 'com.jobswipestudio.onepapier';
const APP_VERSION = require('../../app.json').expo?.version ?? '1.0.0';

const C = {
  bg: '#0D0F14',
  surface: '#161A22',
  border: '#252B36',
  accent: '#3B82F6',
  text: '#F0F4FF',
  muted: '#6B7589',
  white: '#FFFFFF',
};

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [restoring, setRestoring] = useState(false);

  const openUrl = async (url) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Lien indisponible', "Impossible d'ouvrir le lien pour le moment.");
    }
  };

  const rateApp = async () => {
    const market = `market://details?id=${PACKAGE_ID}`;
    const web = `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`;
    const canMarket = await Linking.canOpenURL(market);
    openUrl(canMarket ? market : web);
  };

  const handleRestore = async () => {
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    Alert.alert(
      ok ? 'Achats restaurés' : 'Aucun achat',
      ok
        ? 'Votre abonnement OnePapier Pro a été restauré.'
        : "Aucun achat à restaurer n'a été trouvé pour ce compte.",
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réglages</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.sectionLabel}>Abonnement</Text>
        <View style={styles.group}>
          <Row icon="🔄" label={restoring ? 'Restauration…' : 'Restaurer les achats'} onPress={handleRestore} disabled={restoring} />
        </View>

        <Text style={styles.sectionLabel}>Soutenir OnePapier</Text>
        <View style={styles.group}>
          <Row icon="⭐" label="Noter l'application" onPress={rateApp} />
        </View>

        <Text style={styles.sectionLabel}>Légal</Text>
        <View style={styles.group}>
          <Row icon="🔒" label="Politique de confidentialité" onPress={() => openUrl(PRIVACY_URL)} />
          <Divider />
          <Row icon="📄" label="Conditions d'utilisation" onPress={() => openUrl(TERMS_URL)} />
        </View>

        <Text style={styles.version}>OnePapier · version {APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: C.text, fontSize: 26, lineHeight: 28, includeFontPadding: false, marginTop: -2 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: C.text },

  content: { padding: 20, gap: 8 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 16, marginBottom: 6, marginLeft: 4,
  },
  group: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingHorizontal: 16, paddingVertical: 16,
  },
  rowIcon: { fontSize: 18, width: 22, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 15, color: C.text },
  chevron: { fontSize: 22, color: C.muted },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 52 },

  version: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 28 },
});
