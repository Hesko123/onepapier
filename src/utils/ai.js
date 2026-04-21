import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';
import { GEMINI_API_KEY } from '../config';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

function buildPrompt() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const todayStr = `${dd}/${mm}/${yyyy}`;

  return `Tu es un assistant d'analyse de documents. Analyse attentivement l'image de ce document et réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour.

Format de réponse obligatoire :
{"name":"...","date":"...","category":"...","event":null}

La date d'aujourd'hui est le ${todayStr}. Utilise-la pour calculer les délais relatifs.

Instructions :

1. "name" : nom court et descriptif (ex: "Ordonnance Dr. Martin", "Facture Hôpital Ambroise Paré", "Relevé BNP Octobre 2024")

2. "date" : date à laquelle le document a été ÉMIS, créé, imprimé ou envoyé — PAS la date d'un rendez-vous ou événement futur mentionné dans le document. Retourne UNIQUEMENT la date au format JJ/MM/AAAA ou "JJ mois AAAA". N'inclus jamais de ville, de lieu ou d'autre texte. Si vraiment aucune date d'émission n'est lisible, retourne null.

3. "category" : applique la PREMIÈRE règle qui correspond :
- "medical" : tout document lié à la santé — hôpital, clinique, médecin, pharmacie, laboratoire, mutuelle, même si c'est une facture ou un reçu de paiement
- "finance" : facture non médicale, relevé bancaire, avis d'imposition, bulletin de salaire, quittance de loyer, abonnement téléphone/internet/énergie
- "admin" : courrier administratif, acte officiel, contrat, document d'identité, attestation, assurance
- "other" : uniquement si aucune des catégories ci-dessus ne correspond

4. "event" : uniquement si le document contient une échéance FUTURE ou un événement à venir à noter dans un calendrier. Retourne {"title":"...","isoDate":"YYYY-MM-DD","isoTime":"HH:MM","relativeDays":null}.
- Dates absolues valides : rendez-vous médical, audience, convocation, date limite de paiement explicite — UNIQUEMENT si la date est postérieure à aujourd'hui (${todayStr})
- Délais relatifs ("sous X jours", "dans un délai de X jours", "avant X jours", "d'ici X jours"…) : calcule isoDate en ajoutant X jours à la date du document si présente, sinon à aujourd'hui. Mets relativeDays à X (entier)
- IGNORER absolument : les dates passées, les dates citées comme références historiques ("notre courrier du", "mise en demeure du", "lettre du", "recommandé du", "en date du", "suite à notre"), les dates de création/émission du document
- isoTime est l'heure si visible sinon null
- Si aucune échéance future réelle n'est détectée, retourne null.`;
}

export async function analyzeDocument(imageUri) {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const result = await model.generateContent([
    buildPrompt(),
    { inlineData: { data: base64, mimeType: 'image/jpeg' } },
  ]);

  const raw = result.response.text().trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response: ' + raw);
  const json = JSON.parse(match[0]);

  return {
    name: json.name ?? '',
    date: json.date ?? null,
    category: ['medical', 'finance', 'admin', 'other'].includes(json.category)
      ? json.category
      : 'other',
    event: json.event ? {
      title: json.event.title,
      isoDate: json.event.isoDate,
      isoTime: json.event.isoTime ?? null,
      relativeDays: json.event.relativeDays ?? null,
    } : null,
  };
}
