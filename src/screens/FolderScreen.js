import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, FlatList, TextInput, Alert, Modal, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CATEGORIES, getDocuments, deleteDocument, deleteDocuments, formatDate } from '../utils/storage';

const SORT_MODES = [
  { key: 'savedAt_desc', label: "Date d'ajout : du plus récent au plus ancien" },
  { key: 'savedAt_asc',  label: "Date d'ajout : du plus ancien au plus récent" },
  { key: 'docDate_desc', label: 'Date du document : du plus récent au plus ancien' },
  { key: 'docDate_asc',  label: 'Date du document : du plus ancien au plus récent' },
];

const FRENCH_MONTHS = { janvier:0,février:1,fevrier:1,mars:2,avril:3,mai:4,juin:5,juillet:6,août:7,aout:7,septembre:8,octobre:9,novembre:10,décembre:11,decembre:11 };

function parseDocDate(str, fallbackIso) {
  const fallback = fallbackIso ? new Date(fallbackIso).getTime() : 0;
  const fb = isNaN(fallback) ? 0 : fallback;
  if (!str) return fb;

  // DD/MM/YYYY
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const d = new Date(+slash[3], +slash[2] - 1, +slash[1]);
    if (!isNaN(d)) return d.getTime();
  }
  // YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    if (!isNaN(d)) return d.getTime();
  }
  // "DD mois YYYY" (français, éventuellement dans une phrase)
  const fr = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (fr) {
    const m = FRENCH_MONTHS[fr[2].toLowerCase()];
    if (m !== undefined) {
      const d = new Date(+fr[3], m, +fr[1]);
      if (!isNaN(d)) return d.getTime();
    }
  }
  return fb;
}

const C = {
  bg: '#0D0F14',
  surface: '#161A22',
  border: '#252B36',
  accent: '#3B82F6',
  text: '#F0F4FF',
  muted: '#6B7589',
  white: '#FFFFFF',
  red: '#EF4444',
};

const getCat = id => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[3];

export default function FolderScreen({ navigation, route }) {
  const { category } = route.params;
  const cat = getCat(category);
  const [docs, setDocs] = useState(route.params.docs);

  useFocusEffect(useCallback(() => {
    getDocuments().then(all => {
      const filtered = all.filter(d => d.category === category);
      if (filtered.length === 0) navigation.goBack();
      else setDocs(filtered);
    });
  }, [category]));
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortMode, setSortMode] = useState('savedAt_desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(sortAnim, {
      toValue: showSortMenu ? 1 : 0,
      duration: showSortMenu ? 160 : 120,
      easing: showSortMenu ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showSortMenu]);

  const filtered = (() => {
    const base = query.trim()
      ? docs.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
      : docs;
    return base.slice().sort((a, b) => {
      if (sortMode === 'savedAt_desc') return new Date(b.savedAt) - new Date(a.savedAt);
      if (sortMode === 'savedAt_asc')  return new Date(a.savedAt) - new Date(b.savedAt);
      if (sortMode === 'docDate_desc') return parseDocDate(b.documentDate, b.savedAt) - parseDocDate(a.documentDate, a.savedAt);
      if (sortMode === 'docDate_asc')  return parseDocDate(a.documentDate, a.savedAt) - parseDocDate(b.documentDate, b.savedAt);
      return 0;
    });
  })();

  const enterSelectMode = (id) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    if (next.size === 0) { setSelectMode(false); setSelectedIds(new Set()); }
    else setSelectedIds(next);
  };

  const cancelSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const handleDeleteSelected = () => {
    const n = selectedIds.size;
    Alert.alert(
      `Supprimer ${n} document${n > 1 ? 's' : ''} ?`,
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteDocuments([...selectedIds]);
            const updated = docs.filter(d => !selectedIds.has(d.id));
            cancelSelect();
            if (updated.length === 0) navigation.goBack();
            else setDocs(updated);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        {selectMode ? (
          <>
            <TouchableOpacity onPress={cancelSelect} style={styles.backBtn}>
              <Text style={styles.backArrow}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</Text>
            <TouchableOpacity onPress={() => {
              const allIds = new Set(filtered.map(d => d.id));
              setSelectedIds(allIds);
            }}>
              <Text style={styles.selectAll}>Tout</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <View style={styles.titleRow}>
              <Text style={styles.titleIcon}>{cat.icon}</Text>
              <Text style={styles.title}>{cat.label}</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: cat.color + '22', borderColor: cat.color + '55' }]}>
              <Text style={[styles.countText, { color: cat.color }]}>{filtered.length}</Text>
            </View>
          </>
        )}
      </View>

      {!selectMode && (
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un document…"
              placeholderTextColor={C.muted}
              selectionColor={C.accent}
              clearButtonMode="while-editing"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortMenu(true)} activeOpacity={0.75}>
            <Text style={styles.sortBtnText}>Trier</Text>
            <Text style={styles.sortBtnArrow}>▼</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucun document trouvé</Text>
          </View>
        }
        renderItem={({ item }) => (
          <DocItem
            doc={item}
            navigation={navigation}
            selectMode={selectMode}
            selected={selectedIds.has(item.id)}
            onLongPress={() => enterSelectMode(item.id)}
            onToggle={() => toggleSelect(item.id)}
            onDelete={() => {
              Alert.alert(
                'Supprimer ce document ?',
                `"${item.name}" sera définitivement supprimé.`,
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Supprimer', style: 'destructive',
                    onPress: async () => {
                      await deleteDocument(item.id);
                      const updated = docs.filter(d => d.id !== item.id);
                      if (updated.length === 0) navigation.goBack();
                      else setDocs(updated);
                    },
                  },
                ]
              );
            }}
          />
        )}
      />

      {selectMode && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSelected} activeOpacity={0.85}>
            <Text style={styles.deleteBtnText}>Supprimer ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showSortMenu} transparent animationType="none" onRequestClose={() => setShowSortMenu(false)}>
        <TouchableOpacity style={styles.sortOverlay} activeOpacity={1} onPress={() => setShowSortMenu(false)}>
          <Animated.View
            style={[
              styles.sortMenu,
              {
                opacity: sortAnim,
                transform: [
                  { scale: sortAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                  { translateY: sortAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                ],
              },
            ]}
          >
            <Text style={styles.sortMenuTitle}>Trier par</Text>
            {SORT_MODES.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortMenuItem, sortMode === s.key && styles.sortMenuItemActive]}
                onPress={() => { setSortMode(s.key); setShowSortMenu(false); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.sortMenuItemText, sortMode === s.key && styles.sortMenuItemTextActive]} numberOfLines={2}>{s.label}</Text>
                {sortMode === s.key && <Text style={styles.sortMenuCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function DocItem({ doc, navigation, selectMode, selected, onLongPress, onToggle, onDelete }) {
  const date = formatDate(doc.documentDate, doc.savedAt);

  return (
    <TouchableOpacity
      style={[styles.docItem, selected && styles.docItemSelected]}
      activeOpacity={0.75}
      onPress={() => selectMode ? onToggle() : navigation.navigate('Document', { doc })}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <View style={styles.thumbWrap}>
        <Image source={{ uri: doc.thumbPath }} style={styles.thumb} resizeMode="cover" />
        <View style={styles.pageOverlay}>
          <Text style={styles.pageOverlayText}>{doc.pages ?? 1}</Text>
        </View>
        {selectMode && (
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
        <Text style={styles.docDate}>{date}</Text>
      </View>
      {!selectMode && (
        <>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 6 }}>
            <TrashIcon />
          </TouchableOpacity>
          <Text style={styles.chevron}>›</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function TrashIcon() {
  const red = '#EF4444';
  return (
    <View style={{ width: 20, height: 22, alignItems: 'center' }}>
      <View style={{ width: 16, height: 2, backgroundColor: red, borderRadius: 1 }} />
      <View style={{ width: 6, height: 2, backgroundColor: red, borderRadius: 1, position: 'absolute', top: -3 }} />
      <View style={{
        width: 13, height: 14, marginTop: 2,
        borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
        borderColor: red, borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        paddingHorizontal: 2,
      }}>
        <View style={{ width: 1.5, height: 8, backgroundColor: red, borderRadius: 1 }} />
        <View style={{ width: 1.5, height: 8, backgroundColor: red, borderRadius: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: C.text, fontSize: 18, lineHeight: 18, includeFontPadding: false },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { fontSize: 20 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: C.text },
  selectAll: { fontSize: 14, fontWeight: '600', color: C.accent },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  countText: { fontSize: 13, fontWeight: '700' },

  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 12, gap: 8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 12, height: 44, gap: 8,
  },
  sortBtn: {
    height: 44, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.accent,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  sortBtnText: { fontSize: 13, fontWeight: '600', color: C.accent },
  sortBtnArrow: { fontSize: 9, color: C.accent, marginTop: 1 },

  sortOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    paddingTop: 136, paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  sortMenu: {
    width: '100%', maxWidth: 340,
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 12,
    transformOrigin: 'top right',
  },
  sortMenuTitle: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    letterSpacing: 0.8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
    textTransform: 'uppercase',
  },
  sortMenuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  sortMenuItemActive: { backgroundColor: C.accent + '18' },
  sortMenuItemText: { flex: 1, fontSize: 14, color: C.text, fontWeight: '500', lineHeight: 19 },
  sortMenuItemTextActive: { color: C.accent, fontWeight: '700' },
  sortMenuCheck: { fontSize: 15, color: C.accent, fontWeight: '700' },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  clearBtn: { padding: 4 },
  clearText: { color: C.muted, fontSize: 13 },

  list: { paddingHorizontal: 16, paddingBottom: 100 },
  separator: { height: 1, backgroundColor: C.border, marginHorizontal: 4 },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { color: C.muted, fontSize: 14 },

  docItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingVertical: 14, paddingHorizontal: 4,
    borderRadius: 8,
  },
  docItemSelected: { backgroundColor: C.accent + '15' },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 52, height: 66, borderRadius: 6,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  pageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
    alignItems: 'center', paddingVertical: 2,
  },
  pageOverlayText: { color: '#CBD5E1', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  checkbox: {
    position: 'absolute', bottom: -4, right: -4,
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: C.muted, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: C.accent, borderColor: C.accent },
  checkmark: { color: C.white, fontSize: 11, fontWeight: '700' },
  docInfo: { flex: 1, gap: 4 },
  docName: { fontSize: 15, fontWeight: '600', color: C.text },
  docDate: { fontSize: 12, color: C.muted },
  chevron: { fontSize: 22, color: C.muted, marginRight: 4 },

  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 32,
    backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  deleteBtn: {
    height: 52, backgroundColor: C.red, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 16, fontWeight: '700', color: C.white },
});
