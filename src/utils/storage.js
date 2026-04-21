import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOCS_DIR = FileSystem.documentDirectory + 'documents/';
const STORAGE_KEY = 'docscan_documents';

export const CATEGORIES = [
  { id: 'medical',  label: 'Médical',        icon: '🏥', color: '#EF4444' },
  { id: 'finance',  label: 'Financier',       icon: '💰', color: '#F59E0B' },
  { id: 'admin',    label: 'Administratif',   icon: '📋', color: '#3B82F6' },
  { id: 'other',    label: 'Autre',           icon: '📄', color: '#6B7280' },
];

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DOCS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DOCS_DIR, { intermediates: true });
}

export async function saveDocument({ imageUris, category, name, documentDate, event, notificationIds }) {
  await ensureDir();
  const timestamp = Date.now();
  const id = `doc_${timestamp}`;

  const base64Pages = await Promise.all(
    imageUris.map(uri => FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }))
  );

  const pageImgs = base64Pages.map((b64, i) =>
    `<div class="pg"${i > 0 ? ' style="page-break-before:always;"' : ''}>
       <img src="data:image/jpeg;base64,${b64}" />
     </div>`
  ).join('');

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          @page { size: A4; margin: 0; }
          body { background:#fff; }
          .pg {
            width: 210mm; height: 297mm;
            overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            page-break-inside: avoid;
          }
          .pg img { width: 210mm; height: 297mm; object-fit: contain; display: block; }
        </style>
      </head>
      <body>${pageImgs}</body>
    </html>`;

  const { uri: tmpPdf } = await Print.printToFileAsync({ html, base64: false });

  const pdfPath = DOCS_DIR + id + '.pdf';
  await FileSystem.moveAsync({ from: tmpPdf, to: pdfPath });

  const pagePaths = await Promise.all(
    imageUris.map(async (uri, i) => {
      const path = DOCS_DIR + id + `_thumb${i}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: path });
      return path;
    })
  );

  const doc = {
    id,
    name: name.trim() || 'Document',
    category,
    documentDate: documentDate || null,
    savedAt: new Date().toISOString(),
    pdfPath,
    thumbPath: pagePaths[0],
    pages: imageUris.length,
    pagePaths,
    event: event || null,
    notificationIds: notificationIds || [],
  };

  const existing = await getDocuments();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([doc, ...existing]));
  return doc;
}

export async function getDocuments() {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  const docs = json ? JSON.parse(json) : [];
  return docs.slice().sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

const FRENCH_MONTHS = { janvier:0,février:1,mars:2,avril:3,mai:4,juin:5,juillet:6,août:7,septembre:8,octobre:9,novembre:10,décembre:11 };

export function formatDate(dateStr, fallbackIso) {
  const fmt = d => isNaN(d) ? null : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (dateStr) {
    // DD/MM/YYYY
    const slash = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) { const d = new Date(+slash[3], +slash[2]-1, +slash[1]); const r = fmt(d); if (r) return r; }
    // YYYY-MM-DD
    const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) { const d = new Date(+iso[1], +iso[2]-1, +iso[3]); const r = fmt(d); if (r) return r; }
    // "25 avril 2026" ou "Paris, le 25 avril 2026" — extrait DD mois YYYY n'importe où
    const fr = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (fr) { const m = FRENCH_MONTHS[fr[2].toLowerCase()]; if (m !== undefined) { const d = new Date(+fr[3], m, +fr[1]); const r = fmt(d); if (r) return r; } }
    // Rien de parseable → fallback sur savedAt
  }
  if (fallbackIso) { const r = fmt(new Date(fallbackIso)); if (r) return r; }
  return '';
}

export async function updateDocument(id, updates) {
  const docs = await getDocuments();
  const updated = docs.map(d => d.id === id ? { ...d, ...updates } : d);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function deleteDocument(id) {
  return deleteDocuments([id]);
}

export async function deleteDocuments(ids) {
  const idSet = new Set(ids);
  const docs = await getDocuments();
  const toDelete = docs.filter(d => idSet.has(d.id));
  await Promise.all(toDelete.flatMap(d => {
    const pagePaths = d.pagePaths ?? [d.thumbPath];
    return [
      FileSystem.deleteAsync(d.pdfPath, { idempotent: true }),
      ...pagePaths.map(p => FileSystem.deleteAsync(p, { idempotent: true })),
    ];
  }));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs.filter(d => !idSet.has(d.id))));
}
