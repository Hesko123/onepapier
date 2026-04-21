import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, ActivityIndicator, Alert, Modal,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { CATEGORIES, formatDate, updateDocument } from '../utils/storage';
import { scheduleDeadlineNotification, cancelNotifications } from '../utils/notifications';

const C = {
  bg: '#000000',
  surface: '#161A22',
  border: '#252B36',
  accent: '#3B82F6',
  text: '#F0F4FF',
  muted: '#6B7589',
  white: '#FFFFFF',
};

const getCat = id => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[3];

function maxDaysInMonth(month, year) {
  if (month === 2) return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

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

function PencilIcon() {
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', transform: [{ rotate: '35deg' }] }}>
        <View style={{ width: 5, height: 2.5, backgroundColor: '#94A3B8', borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
        <View style={{ width: 5, height: 1.5, backgroundColor: '#64748B' }} />
        <View style={{ width: 5, height: 7, backgroundColor: C.white }} />
        <View style={{
          width: 0, height: 0,
          borderLeftWidth: 2.5, borderRightWidth: 2.5, borderTopWidth: 4,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderTopColor: C.white,
        }} />
      </View>
    </View>
  );
}

export default function DocumentScreen({ navigation, route }) {
  const [doc, setDoc] = useState(route.params.doc);
  const cat = getCat(doc.category);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef(null);
  const [editingDate, setEditingDate] = useState(false);
  const [draftDate, setDraftDate] = useState('');
  const [dateError, setDateError] = useState('');
  const dateInputRef = useRef(null);
  const date = doc.documentDate ? formatDate(doc.documentDate) : null;

  const totalPages = doc.pages ?? 1;
  const pagePaths = doc.pagePaths ?? [doc.thumbPath];
  const multiPage = totalPages > 1;

  const startEdit = () => {
    setDraftName(doc.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = () => setEditing(false);

  const startEditDate = () => {
    setDraftDate(toInputDate(doc.documentDate));
    setDateError('');
    setEditingDate(true);
    setTimeout(() => dateInputRef.current?.focus(), 100);
  };

  const cancelEditDate = () => { setEditingDate(false); setDateError(''); };

  const confirmEditDate = async () => {
    if (dateError) return;

    let updates = { documentDate: draftDate };

    if (doc.event?.relativeDays != null) {
      const slash = draftDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (slash) {
        const base = new Date(+slash[3], +slash[2] - 1, +slash[1]);
        if (!isNaN(base)) {
          base.setDate(base.getDate() + doc.event.relativeDays);
          const newIso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
          const updatedEvent = { ...doc.event, isoDate: newIso };

          await cancelNotifications(doc.notificationIds);

          let newNotificationIds = [];
          if (new Date(newIso) >= new Date(new Date().toDateString())) {
            newNotificationIds = await scheduleDeadlineNotification(updatedEvent);
          }
          updates = { ...updates, event: updatedEvent, notificationIds: newNotificationIds };
        }
      }
    }

    await updateDocument(doc.id, updates);
    setDoc(d => ({ ...d, ...updates }));
    setEditingDate(false);
  };

  const handleDateChange = (text) => {
    const digits = text.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    setDraftDate(formatted);
    setDateError(validateDateDigits(digits));
  };

  const confirmEdit = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === doc.name) { setEditing(false); return; }
    await updateDocument(doc.id, { name: trimmed });
    setDoc(d => ({ ...d, name: trimmed }));
    setEditing(false);
  };

  const openPdf = async () => {
    setLoading(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Non disponible', 'Le partage n\'est pas disponible sur cet appareil.');
        return;
      }
      const filename = doc.name.replace(/[^a-zA-Z0-9\-_ ]/g, '_') + '.pdf';
      const tmpPath = FileSystem.cacheDirectory + filename;
      await FileSystem.copyAsync({ from: doc.pdfPath, to: tmpPath });
      await Sharing.shareAsync(tmpPath, {
        mimeType: 'application/pdf',
        dialogTitle: doc.name,
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le PDF.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    setLoading(true);
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) return;

      const filename = doc.name.replace(/[^a-zA-Z0-9\-_ ]/g, '_') + '.pdf';
      const base64 = await FileSystem.readAsStringAsync(doc.pdfPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        filename,
        'application/pdf'
      );
      await FileSystem.writeAsStringAsync(newUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      Alert.alert('Téléchargé ✓', `"${filename}" enregistré dans le dossier choisi.`);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de télécharger le PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        {editing ? (
          <>
            <TouchableOpacity onPress={cancelEdit} style={styles.backBtn}>
              <Text style={styles.backArrow}>✕</Text>
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.headerInput}
              value={draftName}
              onChangeText={setDraftName}
              onSubmitEditing={confirmEdit}
              returnKeyType="done"
              selectionColor={C.accent}
              placeholderTextColor={C.muted}
            />
            <TouchableOpacity onPress={confirmEdit} style={styles.confirmBtn}>
              <Text style={styles.confirmBtnText}>✓</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{doc.name}</Text>
            <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
              <PencilIcon />
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* Image plein format */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: pagePaths[currentPage] }} style={styles.image} resizeMode="contain" />
          <View style={styles.pageNav}>
            <TouchableOpacity
              style={[styles.pageArrow, (!multiPage || currentPage === 0) && styles.pageArrowDisabled]}
              onPress={() => setCurrentPage(p => p - 1)}
              disabled={!multiPage || currentPage === 0}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageArrowText, (!multiPage || currentPage === 0) && styles.pageArrowTextDisabled]}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.pageCount}>{currentPage + 1} / {totalPages}</Text>
            <TouchableOpacity
              style={[styles.pageArrow, (!multiPage || currentPage === totalPages - 1) && styles.pageArrowDisabled]}
              onPress={() => setCurrentPage(p => p + 1)}
              disabled={!multiPage || currentPage === totalPages - 1}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageArrowText, (!multiPage || currentPage === totalPages - 1) && styles.pageArrowTextDisabled]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Infos */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Catégorie</Text>
            <View style={[styles.catBadge, { backgroundColor: cat.color + '22', borderColor: cat.color + '55' }]}>
              <Text style={styles.catIcon}>{cat.icon}</Text>
              <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.infoRow} onPress={startEditDate} activeOpacity={0.7}>
            <Text style={styles.infoLabel}>Date du document</Text>
            <Text style={[styles.infoValue, !date && { color: '#6B7589', fontStyle: 'italic' }]}>
              {date || 'Non détectée'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={openPdf}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <>
                  <Text style={styles.btnIcon}>↗️</Text>
                  <Text style={styles.btnPrimaryLabel}>Partager / Exporter le PDF</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={downloadPdf}
            disabled={loading}
            activeOpacity={0.75}
          >
            <Text style={styles.btnIcon}>⬇️</Text>
            <Text style={styles.btnSecondaryLabel}>Sauvegarder le PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={editingDate} transparent animationType="fade" onRequestClose={cancelEditDate} statusBarTranslucent>
        <TouchableOpacity style={styles.dateModalOverlay} activeOpacity={1} onPress={cancelEditDate}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.dateModalCardWrap}>
            <View style={styles.dateModalCard}>
              <Text style={styles.dateModalTitle}>Modifier la date</Text>
              <TextInput
                ref={dateInputRef}
                style={[styles.dateModalInput, dateError && { borderColor: '#EF4444' }]}
                value={draftDate}
                onChangeText={handleDateChange}
                onSubmitEditing={() => { if (!dateError) confirmEditDate(); }}
                placeholder="JJ/MM/AAAA"
                placeholderTextColor={C.muted}
                selectionColor={C.accent}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={10}
                autoFocus
              />
              {dateError
                ? <Text style={styles.dateModalError}>{dateError}</Text>
                : <Text style={styles.dateModalHint}>Format : JJ/MM/AAAA</Text>
              }
              <View style={styles.dateModalActions}>
                <TouchableOpacity style={styles.dateModalCancel} onPress={cancelEditDate}>
                  <Text style={styles.dateModalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateModalConfirm, !!dateError && { opacity: 0.4 }]}
                  onPress={confirmEditDate}
                  disabled={!!dateError}
                >
                  <Text style={styles.dateModalConfirmText}>Confirmer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    gap: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: C.text, fontSize: 18, lineHeight: 18, includeFontPadding: false },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'center' },
  headerInput: {
    flex: 1, fontSize: 15, fontWeight: '600', color: C.text,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.accent,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },

  scroll: { paddingBottom: 40 },

  imageContainer: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#111',
  },
  image: { width: '100%', height: '100%' },

  pageNav: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  pageArrow: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  pageArrowDisabled: { backgroundColor: '#2A2A2A' },
  pageArrowText: { color: C.white, fontSize: 24, lineHeight: 28, fontWeight: '600' },
  pageArrowTextDisabled: { color: '#555' },
  pageCount: { fontSize: 13, color: C.white, fontWeight: '600', minWidth: 40, textAlign: 'center' },

  infoCard: {
    margin: 20,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 14,
  },
  infoLabel: { fontSize: 14, color: C.muted },
  infoValue: { fontSize: 14, color: C.text, fontWeight: '500' },
  dateModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-start', alignItems: 'stretch',
    paddingHorizontal: 20, paddingTop: 120,
  },
  dateModalCardWrap: { alignSelf: 'stretch' },
  dateModalCard: {
    alignSelf: 'stretch', backgroundColor: '#1A1F2E',
    borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 18, gap: 12,
  },
  dateModalTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  dateModalInput: {
    backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.accent,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontSize: 18, fontWeight: '600', textAlign: 'center', letterSpacing: 2,
  },
  dateModalError: { fontSize: 13, color: '#EF4444', fontWeight: '600', textAlign: 'center' },
  dateModalHint: { fontSize: 12, color: C.muted, textAlign: 'center' },
  dateModalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dateModalCancel: {
    flex: 1, height: 46, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dateModalCancelText: { fontSize: 15, color: C.muted, fontWeight: '600' },
  dateModalConfirm: {
    flex: 1, height: 46, borderRadius: 10,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  dateModalConfirmText: { fontSize: 15, color: C.white, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.border },
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  catIcon: { fontSize: 13 },
  catLabel: { fontSize: 13, fontWeight: '600' },

  actions: { paddingHorizontal: 20, gap: 12 },
  btnPrimary: {
    height: 54, backgroundColor: C.accent, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryLabel: { fontSize: 16, fontWeight: '700', color: C.white },
  btnSecondary: {
    height: 50, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnSecondaryLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  btnIcon: { fontSize: 18 },
});
