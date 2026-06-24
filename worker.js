// Cloudflare Worker: nimmt Beleg-Einreichungen von beleg-eingang.html entgegen
// und leitet sie server-seitig (kein CORS-Problem) per WebDAV an Nextcloud weiter.
//
// Deploy: Cloudflare Dashboard -> Workers & Pages -> Create Worker -> diesen
// Code einfuegen -> Settings -> Variables -> Secret "NEXTCLOUD_SHARE_TOKEN"
// anlegen (Wert: der Token aus dem Freigabelink, z.B. "kr8K5LHTHoM2wXS").

const ALLOWED_ORIGIN = 'https://tecko1985.github.io';
const NEXTCLOUD_BASE = 'https://nx88695.your-storageshare.de/public.php/dav/files';

// Missbrauchsschutz: CORS schuetzt nur Browser, nicht den Endpunkt selbst.
// Diese Limits begrenzen, was ueber den offenen POST-Endpunkt hochladbar ist.
const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 10 MB pro Datei
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;  // 25 MB pro Einreichung
const ALLOWED_MIME = /^(image\/|application\/pdf$)/;
const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|heic|heif|pdf)$/i;

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
  async fetch(request, env) {
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
      const name = (form.get('name') || '').toString().trim();
      const amount = (form.get('amount') || '').toString().trim();
      const date = (form.get('date') || '').toString().trim();
      const desc = (form.get('desc') || '').toString().trim();
      const note = (form.get('note') || '').toString().trim();
      const files = form.getAll('files').filter(f => typeof f !== 'string');

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
      const baseName = `${stamp}_${sanitize(date)}_${sanitize(desc)}_${sanitize(name)}`;
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
      };

      await putToNextcloud(token, metaFileName, JSON.stringify(meta, null, 2), 'application/json');

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
