// Cloudflare Worker: nimmt Beleg-Einreichungen von beleg-eingang.html entgegen
// und leitet sie server-seitig (kein CORS-Problem) per WebDAV an Nextcloud weiter.
//
// Deploy: Cloudflare Dashboard -> Workers & Pages -> Create Worker -> diesen
// Code einfuegen -> Settings -> Variables -> Secret "NEXTCLOUD_SHARE_TOKEN"
// anlegen (Wert: der Token aus dem Freigabelink, z.B. "kr8K5LHTHoM2wXS").

const ALLOWED_ORIGIN = 'https://tecko1985.github.io';
const NEXTCLOUD_BASE = 'https://nx88695.your-storageshare.de/public.php/dav/files';

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
      const file = form.get('file');

      if (!name || !desc || !file || typeof file === 'string') {
        throw new Error('Pflichtfelder fehlen (Name, Beschreibung, Datei)');
      }

      const stamp = Date.now();
      const dotIdx = file.name.lastIndexOf('.');
      const ext = dotIdx >= 0 ? file.name.slice(dotIdx) : '';
      const baseName = `${stamp}_${sanitize(date)}_${sanitize(desc)}_${sanitize(name)}`;
      const receiptFileName = `${baseName}${ext}`;
      const metaFileName = `${baseName}.meta.json`;

      const meta = {
        name, amount: parseFloat(amount) || 0, date, desc, note,
        fileOrigName: file.name,
        fileMime: file.type || 'application/octet-stream',
        submittedAt: new Date(stamp).toISOString(),
      };

      await putToNextcloud(token, receiptFileName, await file.arrayBuffer(), file.type);
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
