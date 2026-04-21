import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';

const C = {
  bg: '#000000',
  accent: '#3B82F6',
  white: '#FFFFFF',
  muted: '#9CA3AF',
};

export default function CameraScreen({ navigation }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [status, setStatus] = useState('Initialisation…');

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    setTimeout(() => setStatus('Chargement du scanner…'), 800);
    setTimeout(() => setStatus('Prêt — pointez vers le document'), 2500);
    launchScanner();
  }, []);

  const launchScanner = async () => {
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 50,
      });

      if (scannedImages?.length > 0) {
        navigation.replace('SaveDocument', { imageUris: scannedImages });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      console.error('Erreur scanner :', e);
      navigation.goBack();
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulse }] }]}>
        <View style={styles.iconOuter}>
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
          <View style={styles.scanLine} />
        </View>
      </Animated.View>
      <Text style={styles.label}>{status}</Text>
      <Text style={styles.sub}>Détection automatique des bords</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  iconWrap: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    borderRadius: 24,
    marginBottom: 8,
  },
  iconOuter: {
    width: 56,
    height: 56,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: { position: 'absolute', width: 16, height: 16 },
  cTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderColor: C.accent },
  cTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderColor: C.accent },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: C.accent },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderColor: C.accent },
  scanLine: {
    width: 36,
    height: 2,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    color: C.white,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sub: {
    color: C.muted,
    fontSize: 12,
    letterSpacing: 0.4,
  },
});
