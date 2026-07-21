// Cloudflare Worker: nimmt Beleg-Einreichungen von beleg-eingang.html entgegen
// und leitet sie server-seitig (kein CORS-Problem) per WebDAV an Nextcloud weiter.
//
// Deploy: Cloudflare Dashboard -> Workers & Pages -> Create Worker -> diesen
// Code einfuegen -> Settings -> Variables -> Secret "NEXTCLOUD_SHARE_TOKEN"
// anlegen (Wert: der Token aus dem Freigabelink, z.B. "kr8K5LHTHoM2wXS").
//
// Der Zugriffscode fuer Helfer ist KEIN eigenes Secret hier mehr - er wird
// per verify-action-password an die zentrale ToolsUebersicht-Landingpage
// delegiert (Scope "budget-beleg-eingang", Secret PW_BUDGET_EINGANG_ZUGANG
// dort, siehe E:\ToolsUebersicht\admin-worker.js). Schuetzt den offenen
// POST-Endpunkt davor, dass Unbeteiligte (die nur die URL kennen) Dateien
// hochladen koennen.
//
// Dafuer zusaetzlich ein SERVICE BINDING noetig (Dashboard -> dieser Worker ->
// Bindings -> Add a binding -> Service binding -> Ziel-Worker "landingpage",
// Variablenname "LANDINGPAGE"). Ein normaler fetch() an die *.workers.dev-URL
// der Landingpage wird von Cloudflare mit Error 1042 geblockt, weil beide Worker
// dieselbe workers.dev-Subdomain teilen (sieht aus wie eine potenzielle
// Endlosschleife, ist aber keine) - Service Bindings umgehen das komplett.

const ALLOWED_ORIGIN = 'https://tecko1985.github.io';
const NEXTCLOUD_BASE = 'https://nx88695.your-storageshare.de/public.php/dav/files';

// Missbrauchsschutz: CORS schuetzt nur Browser, nicht den Endpunkt selbst.
// Diese Limits begrenzen, was ueber den offenen POST-Endpunkt hochladbar ist.
const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 10 MB pro Datei
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;  // 25 MB pro Einreichung
const ALLOWED_MIME = /^(image\/|application\/pdf$)/;
const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|heic|heif|pdf)$/i;

// Optionale Korrelations-Id bei Deep-Link aus Fahrtenbuch (?fahrtId=... in
// beleg-eingang.html). Fahrtenbuch-Trip-Ids sind UUIDs (crypto.randomUUID) - nur
// dieses Format zulassen, bevor die Id in den Dateinamen einfliesst (Path-
// Injection-Schutz); admin-worker.js filtert diesen Ordner spaeter per
// Dateinamen-Suffix danach.
const FAHRT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sanitize(name) {
  return (name || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
}

function badRequest(msg) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 400,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

// Delegiert den Zugriffscode-Vergleich an die zentrale Landingpage (Aktion
// verify-action-password) statt ihn lokal gegen ein eigenes Secret zu machen -
// faellt bei Netzfehler oder nicht konfiguriertem Secret dort sicher zu (kein Zugriff).
// Laeuft ueber ein Service Binding (env.LANDINGPAGE), siehe Kommentar oben zu Error 1042.
async function verifyActionPassword(env, scope, password) {
  try {
    const resp = await env.LANDINGPAGE.fetch('https://landingpage/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify-action-password', scope, password }),
    });
    return resp.ok;
  } catch (_) {
    return false;
  }
}

// Benachrichtigungsmail nach erfolgreicher Einreichung. Der Versand selbst liegt in
// der Landingpage (Aktion "beleg-eingang-notify") - der Brevo-API-Key existiert nur
// dort und soll nicht in einen zweiten Worker dupliziert werden. Laeuft ueber
// dasselbe Service Binding wie die Zugriffscode-Pruefung oben; der Code geht mit,
// weil die Aktion dort eigenstaendig prueft (die Landingpage-URL ist oeffentlich).
//
// Schluckt JEDEN Fehler: aufgerufen wird das erst, wenn der Beleg schon vollstaendig
// in Nextcloud liegt. Eine nicht zugestellte Mail darf dem Helfer keine gescheiterte
// Einreichung melden - sichtbar wird so ein Fall nur im Worker-Log.
async function notifyBelegEingang(env, payload) {
  try {
    const resp = await env.LANDINGPAGE.fetch('https://landingpage/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'beleg-eingang-notify', ...payload }),
    });
    if (!resp.ok) {
      console.error(`Beleg-Benachrichtigung fehlgeschlagen (HTTP ${resp.status})`);
    }
  } catch (e) {
    console.error('Beleg-Benachrichtigung fehlgeschlagen:', e.message);
  }
}

async function putToNextcloud(token, filename, body, contentType) {
  const url = `${NEXTCLOUD_BASE}/${encodeURIComponent(token)}/${encodeURIComponent(filename)}`;
  const auth = btoa(`${token}:`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body,
  });
  if (!res.ok) throw new Error(`Nextcloud PUT fehlgeschlagen (${res.status}) fuer ${filename}`);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    try {
      const token = env.NEXTCLOUD_SHARE_TOKEN;
      if (!token) throw new Error('Server nicht konfiguriert (Token fehlt)');

      const form = await request.formData();
      const code = (form.get('code') || '').toString().trim();
      const name = (form.get('name') || '').toString().trim();
      const amount = (form.get('amount') || '').toString().trim();
      const date = (form.get('date') || '').toString().trim();
      const desc = (form.get('desc') || '').toString().trim();
      const note = (form.get('note') || '').toString().trim();
      const rawFahrtId = (form.get('fahrtId') || '').toString().trim();
      const fahrtId = FAHRT_ID_RE.test(rawFahrtId) ? rawFahrtId : null; // ungueltig/fehlend -> wie nicht angegeben behandeln
      const files = form.getAll('files').filter(f => typeof f !== 'string');

      if (!(await verifyActionPassword(env, 'budget-beleg-eingang', code))) {
        return new Response(JSON.stringify({ ok: false, error: 'Falscher Zugriffscode.' }), {
          status: 401,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }

      if (!name || !desc || !files.length) {
        throw new Error('Pflichtfelder fehlen (Name, Beschreibung, Datei)');
      }

      // Eingaben validieren, bevor irgendetwas hochgeladen wird.
      if (files.length > MAX_FILES) {
        return badRequest(`Zu viele Dateien (max. ${MAX_FILES}).`);
      }
      let totalBytes = 0;
      for (const file of files) {
        const typeOk = ALLOWED_MIME.test(file.type || '') || ALLOWED_EXT.test(file.name || '');
        if (!typeOk) return badRequest('Nur Bilder oder PDF-Dateien sind erlaubt.');
        if (file.size > MAX_FILE_BYTES) return badRequest('Eine Datei ist zu groß (max. 10 MB).');
        totalBytes += file.size;
      }
      if (totalBytes > MAX_TOTAL_BYTES) {
        return badRequest('Gesamtgröße der Dateien zu groß (max. 25 MB).');
      }

      const stamp = Date.now();
      const baseName = `${stamp}_${sanitize(date)}_${sanitize(desc)}_${sanitize(name)}${fahrtId ? '_fahrt-' + fahrtId : ''}`;
      const fileEntries = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dotIdx = file.name.lastIndexOf('.');
        const ext = dotIdx >= 0 ? file.name.slice(dotIdx) : '';
        const receiptFileName = files.length > 1 ? `${baseName}_${i + 1}${ext}` : `${baseName}${ext}`;
        await putToNextcloud(token, receiptFileName, await file.arrayBuffer(), file.type);
        fileEntries.push({
          fileName: receiptFileName,
          fileOrigName: file.name,
          fileMime: file.type || 'application/octet-stream',
        });
      }
      const metaFileName = `${baseName}.meta.json`;

      const meta = {
        name, amount: parseFloat(amount) || 0, date, desc, note,
        files: fileEntries,
        // Erstes File zusaetzlich auf Top-Level fuer Abwaertskompatibilitaet mit aelteren Lesern.
        fileOrigName: fileEntries[0].fileOrigName,
        fileMime: fileEntries[0].fileMime,
        submittedAt: new Date(stamp).toISOString(),
        ...(fahrtId ? { fahrtId } : {}), // additiv, nur bei Deep-Link aus Fahrtenbuch gesetzt
      };

      await putToNextcloud(token, metaFileName, JSON.stringify(meta, null, 2), 'application/json');

      // Per waitUntil statt await: der Helfer steht oft im Mobilnetz vor dem
      // Formular und soll die Bestaetigung sehen, sobald der Beleg liegt - nicht
      // erst, wenn auch Brevo geantwortet hat.
      ctx.waitUntil(notifyBelegEingang(env, {
        code,
        name,
        desc,
        note,
        date,
        amount: meta.amount, // exakt der Wert, der auch im Sidecar steht
        fileCount: fileEntries.length,
      }));

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }
  },
};
