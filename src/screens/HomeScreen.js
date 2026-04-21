import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, FlatList, Animated, Easing, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getDocuments, deleteDocument, deleteDocuments, CATEGORIES, formatDate } from '../utils/storage';
import PaywallModal from '../components/PaywallModal';
import { checkPremium } from '../utils/purchases';

const FREE_LIMIT = 15;

const C = {
  bg: '#0D0F14',
  surface: '#161A22',
  border: '#252B36',
  accent: '#3B82F6',
  accentDim: '#1E3A5F',
  text: '#F0F4FF',
  muted: '#6B7589',
  white: '#FFFFFF',
  red: '#EF4444',
};

const getCat = id => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[3];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const rotate = useRef(new Animated.Value(0)).current;
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const [items, setItems] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showPaywall, setShowPaywall] = useState(false);

  const loadDocs = useCallback(() => {
    getDocuments().then(docs => {
      setAllDocs(docs);
      const grouped = docs.reduce((acc, doc) => {
        if (!acc[doc.category]) acc[doc.category] = [];
        acc[doc.category].push(doc);
        return acc;
      }, {});
      const list = Object.entries(grouped).flatMap(([category, catDocs]) =>
        catDocs.length === 1
          ? [{ type: 'doc', ...catDocs[0] }]
          : [{ type: 'folder', id: `folder_${category}`, category, docs: catDocs }]
      );
      setItems(list);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    loadDocs();
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [loadDocs]));

  const enterSelectMode = (id) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    if (next.size === 0) cancelSelect();
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
            cancelSelect();
            loadDocs();
          },
        },
      ]
    );
  };

  const handleScan = async () => {
    const docs = await getDocuments();
    if (docs.length >= FREE_LIMIT) {
      const premium = await checkPremium();
      if (!premium) { setShowPaywall(true); return; }
    }
    Animated.timing(rotate, {
      toValue: 1, duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => rotate.setValue(0));
    navigation.navigate('Camera');
  };

  const selectableItems = items.filter(i => i.type === 'doc');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {selectMode ? (
        <View style={styles.selectHeader}>
          <TouchableOpacity onPress={cancelSelect} style={styles.backBtn}>
            <Text style={styles.backArrow}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.selectTitle}>{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</Text>
          <TouchableOpacity onPress={() => setSelectedIds(new Set(selectableItems.map(i => i.id)))}>
            <Text style={styles.selectAll}>Tout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.logoRow}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logoIcon} />
              <Text style={styles.logoText}>OnePapier</Text>
            </View>
            <Text style={styles.tagline}>Zéro paperasse</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.gearBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.gearIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      )}

      {items.length === 0 ? (
        <View style={styles.empty}>
          <EmptyIcon />
          <Text style={styles.emptyTitle}>Aucun document</Text>
          <Text style={styles.emptySub}>
            Scannez votre premier document{'\n'}pour le retrouver ici
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, selectMode && { paddingBottom: 100 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) =>
            item.type === 'folder'
              ? <FolderItem item={item} navigation={navigation} selectMode={selectMode} />
              : <DocItem
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
                          onPress: async () => { await deleteDocument(item.id); loadDocs(); },
                        },
                      ]
                    );
                  }}
                />
          }
        />
      )}

      {selectMode ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom + 12, 32) }]}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSelected} activeOpacity={0.85}>
            <Text style={styles.deleteBtnText}>Supprimer ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + 12, 32) }]}>
          <View style={styles.tip}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>Déplier le document à plat pour un meilleur résultat</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={handleScan} activeOpacity={0.85}>
            <Animated.View style={[styles.btnIconWrap, { transform: [{ rotate: spin }] }]}>
              <ScanLineIcon />
            </Animated.View>
            <Text style={styles.btnLabel}>Scanner</Text>
          </TouchableOpacity>
        </View>
      )}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribe={() => setShowPaywall(false)}
      />
    </SafeAreaView>
  );
}

function FolderItem({ item, navigation, selectMode }) {
  const cat = getCat(item.category);
  const thumbs = item.docs.slice(0, 3);
  const latest = item.docs[0];
  const date = formatDate(latest.documentDate, latest.savedAt);

  return (
    <TouchableOpacity
      style={[styles.folderItem, selectMode && { opacity: 0.4 }]}
      activeOpacity={0.75}
      disabled={selectMode}
      onPress={() => navigation.navigate('Folder', { category: item.category, docs: item.docs })}
    >
      <View style={[styles.folderIconWrap, { backgroundColor: cat.color + '18', borderColor: cat.color + '40' }]}>
        <Text style={styles.folderIcon}>{cat.icon}</Text>
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docName}>{cat.label}</Text>
        <Text style={styles.docDate}>{item.docs.length} documents · dernier le {date}</Text>
      </View>
      <View style={styles.thumbStack}>
        {thumbs.map((d, i) => (
          <Image
            key={d.id}
            source={{ uri: d.thumbPath }}
            style={[styles.stackThumb, { right: i * 10, zIndex: thumbs.length - i }]}
            resizeMode="cover"
          />
        ))}
      </View>
      <Text style={[styles.chevron, { marginLeft: thumbs.length > 1 ? 20 : 0 }]}>›</Text>
    </TouchableOpacity>
  );
}

function DocItem({ doc, navigation, selectMode, selected, onLongPress, onToggle, onDelete }) {
  const cat = getCat(doc.category);
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
        {selectMode && (
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
        <Text style={styles.docDate}>{date}</Text>
        <View style={[styles.catBadge, { backgroundColor: cat.color + '22', borderColor: cat.color + '55' }]}>
          <Text style={styles.catBadgeIcon}>{cat.icon}</Text>
          <Text style={[styles.catBadgeLabel, { color: cat.color }]}>{cat.label}</Text>
        </View>
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

function EmptyIcon() {
  return (
    <View style={iconStyles.wrap}>
      <View style={iconStyles.outer}>
        <View style={iconStyles.inner} />
        <View style={[iconStyles.corner, iconStyles.cTL]} />
        <View style={[iconStyles.corner, iconStyles.cTR]} />
        <View style={[iconStyles.corner, iconStyles.cBL]} />
        <View style={[iconStyles.corner, iconStyles.cBR]} />
      </View>
    </View>
  );
}

function ScanLineIcon() {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: C.white, borderRadius: 2 }} />
      <View style={{ position: 'absolute', width: 8, height: 1.5, backgroundColor: C.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 28, paddingTop: 24, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  gearBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  gearIcon: { fontSize: 18 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  logoIcon: { width: 26, height: 26, borderRadius: 6 },
  logoText: { fontFamily: 'monospace', fontSize: 20, fontWeight: '700', color: C.text, letterSpacing: 1 },
  tagline: { fontSize: 12, color: C.muted, letterSpacing: 0.5, marginLeft: 32 },

  selectHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: C.text, fontSize: 18, lineHeight: 18, includeFontPadding: false },
  selectTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: C.text },
  selectAll: { fontSize: 14, fontWeight: '600', color: C.accent },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.text },
  emptySub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },

  list: { padding: 16 },
  separator: { height: 1, backgroundColor: C.border, marginHorizontal: 4 },

  docItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 8,
  },
  docItemSelected: { backgroundColor: C.accent + '15' },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 52, height: 66, borderRadius: 6,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
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
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, marginTop: 2,
  },
  catBadgeIcon: { fontSize: 11 },
  catBadgeLabel: { fontSize: 11, fontWeight: '600' },
  chevron: { fontSize: 22, color: C.muted, marginRight: 4 },

  folderItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingVertical: 14, paddingHorizontal: 4,
  },
  folderIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  folderIcon: { fontSize: 24 },
  thumbStack: { position: 'relative', width: 52, height: 52 },
  stackThumb: {
    position: 'absolute', width: 36, height: 46,
    borderRadius: 5, borderWidth: 1.5,
    borderColor: C.bg, backgroundColor: C.surface,
  },

  bottom: {
    paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12,
    gap: 12, borderTopWidth: 1, borderTopColor: C.border,
  },
  tip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1C2333', borderWidth: 1, borderColor: '#2A3347',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  tipIcon: { fontSize: 14 },
  tipText: { fontSize: 13, color: '#A0AABB', lineHeight: 18, flex: 1 },
  btn: {
    height: 54, backgroundColor: C.accent, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  btnIconWrap: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  btnLabel: { fontSize: 16, fontWeight: '700', color: C.white, letterSpacing: 0.3 },

  actionBar: {
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

const iconStyles = StyleSheet.create({
  wrap: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center', backgroundColor: C.accentDim, borderRadius: 22 },
  outer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  inner: { width: 30, height: 30, backgroundColor: C.bg, borderRadius: 3 },
  corner: { position: 'absolute', width: 13, height: 13 },
  cTL: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderColor: C.accent },
  cTR: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderColor: C.accent },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderColor: C.accent },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderColor: C.accent },
});
