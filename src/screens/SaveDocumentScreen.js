import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Modal, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Calendar from 'expo-calendar';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { saveDocument, CATEGORIES, formatDate } from '../utils/storage';
import { analyzeDocument } from '../utils/ai';
import { scheduleDeadlineNotification, cancelNotifications } from '../utils/notifications';

const C = {
  bg: '#0D0F14',
  surface: '#161A22',
  border: '#252B36',
  accent: '#3B82F6',
  text: '#F0F4FF',
  muted: '#6B7589',
  white: '#FFFFFF',
};

const getCat = id => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[3];

const FR_MONTHS = { janvier:1,février:2,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,août:8,aout:8,septembre:9,octobre:10,novembre:11,décembre:12,decembre:12 };

function toInputDate(str) {
  if (!str) return '';
  const pad = n => String(n).padStart(2, '0');
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${pad(slash[1])}/${pad(slash[2])}/${slash[3]}`;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const fr = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (fr) {
    const m = FR_MONTHS[fr[2].toLowerCase()];
    if (m !== undefined) return `${pad(fr[1])}/${pad(m)}/${fr[3]}`;
  }
  return '';
}

function maxDaysInMonth(month, year) {
  if (month === 2) return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validateDateDigits(digits) {
  if (digits.length < 2) return '';
  const day = parseInt(digits.slice(0, 2));
  if (day < 1 || day > 31) return 'Jour invalide (01–31)';
  if (digits.length >= 4) {
    const month = parseInt(digits.slice(2, 4));
    if (month < 1 || month > 12) return 'Mois invalide (01–12)';
    const year = digits.length >= 8 ? parseInt(digits.slice(4, 8)) : 2000;
    const max = maxDaysInMonth(month, year);
    if (day > max) return `Ce mois n'a que ${max} jours`;
  }
  return '';
}

export default function SaveDocumentScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [imageUris, setImageUris] = useState(route.params.imageUris);
  const imageUri = imageUris[0];
  const [name, setName] = useState('');
  const [docDate, setDocDate] = useState('');
  const [category, setCategory] = useState('other');
  const [analyzing, setAnalyzing] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingDate, setEditingDate] = useState(false);
  const [dateError, setDateError] = useState('');
  const dateInputRef = useRef(null);
  const [event, setEvent] = useState(null);
  const [showCalModal, setShowCalModal] = useState(false);
  const [calAdded, setCalAdded] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [atBottom, setAtBottom] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    analyzeDocument(imageUri)
      .then(result => {
        setName(result.name);
        setDocDate(result.date ?? '');
        setCategory(result.category);
        const ev = result.event ?? null;
        setEvent(ev);
        if (ev) {
          const [y, m, d] = ev.isoDate.split('-');
          setEditDate(`${d}/${m}/${y}`);
          setEditTime(ev.isoTime ?? '');
        }
      })
      .catch(() => {
        setName('Document');
        setDocDate('');
      })
      .finally(() => setAnalyzing(false));
  }, []);

  const addPage = async () => {
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({ croppedImageQuality: 100, maxNumDocuments: 50 });
      if (scannedImages?.length) setImageUris(prev => [...prev, ...scannedImages]);
    } catch {}
  };

  const recalcEventDate = (newDocDate) => {
    if (!event || event.relativeDays === null || event.relativeDays === undefined) return;
    const slash = newDocDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!slash) return;
    const base = new Date(+slash[3], +slash[2] - 1, +slash[1]);
    if (isNaN(base)) return;
    base.setDate(base.getDate() + event.relativeDays);
    const newIso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    setEvent(ev => ({ ...ev, isoDate: newIso }));
    const [y, m, d] = newIso.split('-');
    setEditDate(`${d}/${m}/${y}`);
  };

  const addToCalendar = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Accès au calendrier requis',
          'Dans la page qui s\'ouvre : appuyez sur "Autorisations" puis activez "Calendrier".',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Ouvrir les paramètres', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCal = calendars.find(c => c.isPrimary) ?? calendars[0];
      if (!defaultCal) {
        Alert.alert('Erreur', 'Aucun calendrier trouvé sur cet appareil.');
        return;
      }
      const [d, m, y] = editDate.split('/');
      const isoConverted = `${y}-${m}-${d}`;
      const startDate = new Date(isoConverted + (editTime ? 'T' + editTime : 'T09:00'));
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      await Calendar.createEventAsync(defaultCal.id, {
        title: event.title,
        startDate,
        endDate,
        notes: name,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setShowCalModal(false);
      setCalAdded(true);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'événement.');
    }
  };

  const handleSave = async () => {
    if (dateError) return;
    setSaving(true);
    try {
      let notificationIds = [];
      if (event && new Date(event.isoDate) >= new Date(new Date().toDateString())) {
        notificationIds = await scheduleDeadlineNotification(event);
      }
      await saveDocument({ imageUris, category, name, documentDate: docDate, event, notificationIds });
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const cat = getCat(category);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
          keyboardShouldPersistTaps="handled"
          onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
            setAtBottom(layoutMeasurement.height + contentOffset.y >= contentSize.height - 40);
          }}
          scrollEventThrottle={16}
        >

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Enregistrer</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            {imageUris.length > 1 && (
              <View style={styles.pageBadge}>
                <Text style={styles.pageBadgeText}>{imageUris.length} pages</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.addPageBtn, imageUris.length >= 50 && { opacity: 0.4 }]}
              onPress={addPage}
              disabled={imageUris.length >= 50}
              activeOpacity={0.8}
            >
              <Text style={styles.addPageText}>+ Ajouter une page</Text>
            </TouchableOpacity>
          </View>

          {/* AI analysis loading / result */}
          {analyzing ? (
            <View style={styles.analyzing}>
              <ActivityIndicator color={C.accent} size="small" />
              <Text style={styles.analyzingText}>Analyse du document en cours…</Text>
            </View>
          ) : (
            <>
              {/* Catégorie détectée */}
              <View style={[styles.catDetected, { borderColor: cat.color + '55', backgroundColor: cat.color + '15' }]}>
                <Text style={styles.catDetectedIcon}>{cat.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catDetectedSub}>Catégorie détectée</Text>
                  <Text style={[styles.catDetectedLabel, { color: cat.color }]}>{cat.label}</Text>
                </View>
              </View>

              {/* Nom */}
              <Text style={styles.label}>Nom du document</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholderTextColor={C.muted}
                selectionColor={C.accent}
              />

              {/* Date du document */}
              <Text style={styles.label}>Date du document</Text>
              <TouchableOpacity
                style={[styles.dateRow, editingDate && { borderColor: C.accent }]}
                onPress={() => {
                  setDocDate(toInputDate(docDate));
                  setEditingDate(true);
                  setTimeout(() => dateInputRef.current?.focus(), 50);
                }}
                activeOpacity={0.75}
              >
                {editingDate ? (
                  <TextInput
                    ref={dateInputRef}
                    style={styles.dateInput}
                    value={docDate}
                    onChangeText={(text) => {
                      const digits = text.replace(/\D/g, '');
                      let formatted = digits;
                      if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
                      if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
                      setDocDate(formatted);
                      setDateError(validateDateDigits(digits));
                    }}
                    onBlur={() => {
                      if (!dateError) {
                        setEditingDate(false);
                        recalcEventDate(docDate);
                      }
                    }}
                    onSubmitEditing={() => {
                      if (!dateError) {
                        setEditingDate(false);
                        recalcEventDate(docDate);
                      }
                    }}
                    placeholder="JJ/MM/AAAA"
                    placeholderTextColor={C.muted}
                    selectionColor={C.accent}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={10}
                  />
                ) : (
                  <>
                    <Text style={[styles.dateValue, !docDate && styles.dateEmpty]}>
                      {docDate ? (formatDate(docDate) || docDate) : 'Non détectée — appuyez pour saisir'}
                    </Text>
                    <Text style={styles.dateEditHint}>✎</Text>
                  </>
                )}
              </TouchableOpacity>

              {dateError ? <Text style={styles.dateError}>{dateError}</Text> : null}

              {/* Changer catégorie */}
              <Text style={styles.label}>Modifier la catégorie</Text>
              <View style={styles.categories}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catBtn, category === c.id && { borderColor: c.color, backgroundColor: c.color + '22' }]}
                    onPress={() => setCategory(c.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.catIcon}>{c.icon}</Text>
                    <Text style={[styles.catLabel, category === c.id && { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Calendrier */}
              {event && new Date(event.isoDate) >= new Date(new Date().toDateString()) && (
                calAdded ? (
                  <View style={styles.calAdded}>
                    <Text style={styles.calAddedText}>✓ Ajouté au calendrier</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.calBtn} onPress={() => setShowCalModal(true)} activeOpacity={0.85}>
                    <Text style={styles.calBtnIcon}>📅</Text>
                    <Text style={styles.calBtnLabel}>Ajouter au calendrier</Text>
                  </TouchableOpacity>
                )
              )}

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, (saving || dateError) && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={saving || !!dateError}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color={C.white} />
                  : <Text style={styles.saveBtnLabel}>Enregistrer</Text>
                }
              </TouchableOpacity>

              {/* Modal calendrier */}
              <Modal visible={showCalModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>Ajouter au calendrier</Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Événement</Text>
                      <Text style={styles.modalValue}>{event?.title}</Text>
                    </View>
                    <View style={styles.modalDivider} />
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Date (JJ/MM/AAAA)</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editDate}
                        onChangeText={setEditDate}
                        placeholder="JJ/MM/AAAA"
                        placeholderTextColor={C.muted}
                        keyboardType="numeric"
                        selectionColor={C.accent}
                      />
                    </View>
                    {event?.isoTime && (
                      <>
                        <View style={styles.modalDivider} />
                        <View style={styles.modalRow}>
                          <Text style={styles.modalLabel}>Heure (HH:MM)</Text>
                          <TextInput
                            style={styles.modalInput}
                            value={editTime}
                            onChangeText={setEditTime}
                            placeholder="HH:MM"
                            placeholderTextColor={C.muted}
                            keyboardType="numeric"
                            selectionColor={C.accent}
                          />
                        </View>
                      </>
                    )}
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCalModal(false)}>
                        <Text style={styles.modalCancelText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalConfirm} onPress={addToCalendar}>
                        <Text style={styles.modalConfirmText}>Confirmer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </>
          )}
        </ScrollView>

        {!atBottom && !analyzing && (
          <TouchableOpacity
            style={styles.scrollFab}
            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            activeOpacity={0.85}
          >
            <Text style={styles.scrollFabArrow}>↓</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, gap: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: C.text, fontSize: 18, lineHeight: 18, includeFontPadding: false },
  title: { fontSize: 18, fontWeight: '700', color: C.text },

  preview: {
    height: 220, borderRadius: 12, overflow: 'hidden',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  image: { width: '100%', height: '100%' },
  pageBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pageBadgeText: { color: C.white, fontSize: 12, fontWeight: '700' },
  addPageBtn: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(59,130,246,0.9)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  addPageText: { color: C.white, fontSize: 12, fontWeight: '700' },

  analyzing: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 16,
  },
  analyzingText: { color: C.muted, fontSize: 14 },

  catDetected: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 12, padding: 14,
  },
  catDetectedIcon: { fontSize: 24 },
  catDetectedSub: { fontSize: 11, color: C.muted, marginBottom: 2 },
  catDetectedLabel: { fontSize: 16, fontWeight: '700' },

  label: { fontSize: 13, color: C.muted, fontWeight: '600', letterSpacing: 0.5, marginTop: 4 },

  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: C.text, fontSize: 15,
  },

  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface,
  },
  catIcon: { fontSize: 16 },
  catLabel: { fontSize: 14, color: C.muted, fontWeight: '500' },

  saveBtn: {
    height: 54, backgroundColor: C.accent, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnLabel: { fontSize: 16, fontWeight: '700', color: C.white },


  dateRow: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateValue: { fontSize: 15, color: C.text, flex: 1 },
  dateEmpty: { color: C.muted, fontStyle: 'italic' },
  dateEditHint: { fontSize: 16, color: '#CBD5E1', marginLeft: 8, transform: [{ scaleX: -1 }] },
  dateError: { fontSize: 12, color: '#EF4444', fontWeight: '600', marginTop: -8 },
  dateInput: { flex: 1, fontSize: 15, color: C.text, padding: 0 },

  calBtn: {
    height: 50, borderRadius: 12, borderWidth: 1.5,
    borderColor: '#2563EB', backgroundColor: '#1E3A5F',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  calBtnIcon: { fontSize: 18 },
  calBtnLabel: { fontSize: 15, fontWeight: '600', color: '#93C5FD' },
  calAdded: {
    height: 50, borderRadius: 12, borderWidth: 1.5,
    borderColor: '#16A34A', backgroundColor: '#14532D',
    alignItems: 'center', justifyContent: 'center',
  },
  calAddedText: { fontSize: 14, fontWeight: '600', color: '#86EFAC' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalCard: {
    width: '100%', backgroundColor: '#1A1F2E',
    borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20, gap: 4,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  modalLabel: { fontSize: 13, color: C.muted },
  modalValue: { fontSize: 14, fontWeight: '600', color: C.text, flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  modalDivider: { height: 1, backgroundColor: C.border },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1, height: 46, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: { fontSize: 15, color: C.muted, fontWeight: '600' },
  modalConfirm: {
    flex: 1, height: 46, borderRadius: 10,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  modalConfirmText: { fontSize: 15, color: C.white, fontWeight: '700' },

  scrollFab: {
    position: 'absolute', bottom: 12, right: 12,
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  scrollFabArrow: { color: C.white, fontSize: 20, lineHeight: 24 },
  modalInput: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    color: C.text, fontSize: 14, minWidth: 110, textAlign: 'center',
  },
});
