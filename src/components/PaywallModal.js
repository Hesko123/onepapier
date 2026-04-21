import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, SafeAreaView, Image, ActivityIndicator, Alert,
} from 'react-native';
import { getOfferings, purchasePackage, restorePurchases } from '../utils/purchases';

const C = {
  bg: '#0D0F14',
  surface: '#161A22',
  border: '#252B36',
  accent: '#3B82F6',
  accentDim: '#1E3A5F',
  text: '#F0F4FF',
  muted: '#6B7589',
  white: '#FFFFFF',
  gold: '#F59E0B',
};


export default function PaywallModal({ visible, onClose, onSubscribe }) {
  const [plan, setPlan] = useState('annual');
  const [offering, setOffering] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) getOfferings().then(setOffering);
  }, [visible]);

  const getPackage = (type) =>
    offering?.availablePackages?.find(p =>
      type === 'annual' ? p.packageType === 'ANNUAL' : p.packageType === 'MONTHLY'
    ) ?? null;

  const handleSubscribe = async () => {
    const pkg = getPackage(plan);
    if (!pkg) { Alert.alert('Produit introuvable', 'Réessayez dans quelques instants.'); return; }
    setLoading(true);
    try {
      const isPremium = await purchasePackage(pkg);
      if (isPremium) { onSubscribe(); onClose(); }
    } catch (e) {
      if (!e.userCancelled) Alert.alert('Erreur', 'Achat impossible. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const isPremium = await restorePurchases();
      if (isPremium) { onSubscribe(); onClose(); }
      else Alert.alert('Aucun achat trouvé', 'Aucun abonnement actif sur ce compte.');
    } catch {
      Alert.alert('Erreur', 'Impossible de restaurer les achats.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          <View style={styles.handle} />

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          {/* Logo + titre */}
          <View style={styles.iconWrap}>
            <Image
              source={require('../../assets/images/android-icon-foreground.png')}
              style={styles.iconImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>OnePapier Pro</Text>
          <Text style={styles.subtitle}>Vous avez utilisé vos 15 scans gratuits.</Text>
          <Text style={styles.subtitleCta}>Passez Pro pour scanner sans limite.</Text>

          {/* Plans */}
          <TouchableOpacity
            style={[styles.planCard, plan === 'annual' && styles.planCardSelected]}
            onPress={() => setPlan('annual')}
            activeOpacity={0.8}
          >
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>Meilleure offre</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={[styles.planLabel, plan === 'annual' && styles.planLabelSelected]}>Annuel</Text>
              <Text style={[styles.planPrice, plan === 'annual' && styles.planPriceSelected]}>
                19,99€<Text style={styles.planPer}> / an</Text>
              </Text>
            </View>
            <Text style={styles.planSub}>Économisez 44% · soit 1,66€/mois</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, plan === 'monthly' && styles.planCardSelected]}
            onPress={() => setPlan('monthly')}
            activeOpacity={0.8}
          >
            <View style={styles.planRow}>
              <Text style={[styles.planLabel, plan === 'monthly' && styles.planLabelSelected]}>Mensuel</Text>
              <Text style={[styles.planPrice, plan === 'monthly' && styles.planPriceSelected]}>
                2,99€<Text style={styles.planPer}> / mois</Text>
              </Text>
            </View>
          </TouchableOpacity>

          {/* CTA */}
          <TouchableOpacity style={[styles.cta, loading && { opacity: 0.6 }]} onPress={handleSubscribe} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={styles.ctaText}>Commencer →</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestore} disabled={loading} activeOpacity={0.6} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Restaurer les achats</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>Annulable à tout moment · Renouvellement automatique</Text>

          <SafeAreaView />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },

  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: 'center', marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 20,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: C.muted, fontSize: 13, fontWeight: '700' },

  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#2D1F00',
    borderWidth: 1.5, borderColor: C.gold + '60',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
    shadowColor: C.gold, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  iconImg: { width: 54, height: 54, tintColor: C.gold },

  title: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 4 },
  subtitleCta: { fontSize: 16, fontWeight: '700', color: C.white, textAlign: 'center', marginBottom: 24 },

  planCard: {
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 14, padding: 14,
    marginBottom: 10, position: 'relative',
  },
  planCardSelected: { borderColor: C.accent, backgroundColor: C.accentDim + '55' },
  planBadge: {
    position: 'absolute', top: -10, right: 14,
    backgroundColor: C.gold, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  planBadgeText: { fontSize: 10, fontWeight: '800', color: '#1C1000' },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel: { fontSize: 15, fontWeight: '600', color: C.muted },
  planLabelSelected: { color: C.text },
  planPrice: { fontSize: 18, fontWeight: '800', color: C.muted },
  planPriceSelected: { color: C.text },
  planPer: { fontSize: 13, fontWeight: '400', color: C.muted },
  planSub: { fontSize: 12, color: C.muted, marginTop: 3 },

  cta: {
    height: 54, backgroundColor: C.accent, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 14,
  },
  ctaText: { fontSize: 17, fontWeight: '800', color: C.white, letterSpacing: 0.3 },

  restoreBtn: { alignItems: 'center', marginBottom: 10 },
  restoreText: { fontSize: 13, color: C.muted, textDecorationLine: 'underline' },
  legal: { fontSize: 11, color: C.border, textAlign: 'center', marginBottom: 4 },
});
