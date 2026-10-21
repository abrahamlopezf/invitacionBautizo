const https = require('https');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { syncFromGoogleSheets } = require('./sync_sheets');

const firebaseConfig = {
  projectId: "invbacatherine",
  appId: "1:421006239065:web:720c3ff56046c48c461848",
  databaseURL: "https://invbacatherine-default-rtdb.firebaseio.com",
  storageBucket: "invbacatherine.firebasestorage.app",
  apiKey: "AIzaSyCmDzOpq1y5_l0svS2SAnx9BABCH7g22hc",
  authDomain: "invbacatherine.firebaseapp.com",
  messagingSenderId: "421006239065"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("⚠️ ADVERTENCIA: TELEGRAM_BOT_TOKEN no está definido en variables de entorno.");
}
const AUTHORIZED_CHAT_IDS = ["5215477099", "6299608285"]; // Abraham Lopez & Liz Lopez

let lastUpdateId = 0;

function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) {
    console.warn("⚠️ sendTelegramMessage omitido: BOT_TOKEN no definido.");
    return;
  }
  const payload = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {});
  });

  req.on('error', err => {
    console.error("Error enviando mensaje a Telegram:", err);
  });

  req.write(payload);
  req.end();
}

async function getConfirmationReport() {
  const snapshot = await getDocs(collection(db, 'invitados'));
  let totalH = 0, totalM = 0, totalN = 0, totalA = 0;
  let totalRegistrados = 0;
  const confirmados = [];
  const pendientes = [];

  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    if (d.nombre === 'LIZ PENA' && !d.estado) return;

    totalRegistrados++;
    const h = d.hombres || 0;
    const m = d.mujeres || 0;
    const n = d.ninos || 0;
    const t = d.total_asistiran !== undefined ? d.total_asistiran : (h + m + n);

    if (d.estado === 'Confirmado' || (d.fecha_confirmacion && t !== undefined)) {
      totalH += h;
      totalM += m;
      totalN += n;
      totalA += t;
      confirmados.push({
        nombre: d.nombre,
        pases: d.cantidad_considerada || 0,
        hombres: h,
        mujeres: m,
        ninos: n,
        total: t,
        noAsiste: (t === 0)
      });
    } else {
      pendientes.push({
        nombre: d.nombre,
        pases: d.cantidad_considerada || 0
      });
    }
  });

  confirmados.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));

  const tableRows = confirmados.map(item => {
    const namePadded = item.nombre.length > 17 ? item.nombre.substring(0, 16) + '…' : item.nombre.padEnd(17, ' ');
    if (item.noAsiste) {
      return `${namePadded} [No asiste]`;
    }
    return `${namePadded} (${item.total}) [${item.hombres}H/${item.mujeres}M/${item.ninos}N]`;
  }).join('\n');

  return `📊 <b>ESTADO ACTUAL DE CONFIRMACIONES</b>\n\n` +
    `👥 <b>Total personas confirmadas:</b> ${totalA}\n` +
    `👨 <b>Hombres:</b> ${totalH} | 👩 <b>Mujeres:</b> ${totalM} | 🧒 <b>Niños:</b> ${totalN}\n` +
    `🏠 <b>Familias que respondieron:</b> ${confirmados.length} de ${totalRegistrados}\n` +
    `⏳ <b>Familias pendientes:</b> ${pendientes.length}\n\n` +
    `📋 <b>DETALLE DE ASISTENCIA:</b>\n` +
    `<pre>${tableRows}</pre>`;
}

function processMessage(msg) {
  if (!msg || !msg.text) return;
  const chatId = String(msg.chat.id);

  if (!AUTHORIZED_CHAT_IDS.includes(chatId)) {
    sendTelegramMessage(chatId, "🔒 Lo siento, este bot es privado para los organizadores del bautizo de Catherine.");
    return;
  }

  const text = msg.text.toLowerCase().trim();

  const isSync = text.includes('sincroni') || text === '/sincronizar' || text === '/sync';

  if (isSync) {
    sendTelegramMessage(chatId, "⏳ Consultando Google Sheets y sincronizando base de datos...");
    syncFromGoogleSheets().then(changes => {
      let reply = `✅ <b>Sincronización con Google Sheets completada</b>\n\n`;
      if (changes.agregados.length > 0) {
        reply += `✨ <b>Agregados (${changes.agregados.length}):</b>\n` + changes.agregados.map(a => `• ${a.nombre} (${a.qty} pases)`).join('\n') + `\n\n`;
      }
      if (changes.actualizados.length > 0) {
        reply += `🔄 <b>Actualizados (${changes.actualizados.length}):</b>\n` + changes.actualizados.map(a => `• ${a.nombre} (${a.anterior} ➔ ${a.nuevo} pases)`).join('\n') + `\n\n`;
      }
      if (changes.eliminados.length > 0) {
        reply += `🗑️ <b>Eliminados (${changes.eliminados.length}):</b>\n` + changes.eliminados.map(e => `• ${e}`).join('\n') + `\n\n`;
      }
      if (changes.agregados.length === 0 && changes.actualizados.length === 0 && changes.eliminados.length === 0) {
        reply += `👌 Todo al día: no hubo cambios nuevos en el Excel (${changes.sinCambios} invitados activos).\n`;
      }
      sendTelegramMessage(chatId, reply);
    }).catch(err => {
      sendTelegramMessage(chatId, `❌ Error al sincronizar con Google Sheets: ${err.message}`);
    });
    return;
  }

  const isQuery = text.includes('cuanto') ||
                  text.includes('confirmad') ||
                  text.includes('lista') ||
                  text.includes('resumen') ||
                  text.includes('asist') ||
                  text.includes('quien') ||
                  text.includes('tabla') ||
                  text === '/resumen' ||
                  text === '/confirmados' ||
                  text === '/start';

  if (isQuery) {
    getConfirmationReport().then(report => {
      sendTelegramMessage(chatId, report);
    }).catch(err => {
      console.error("Error generando reporte:", err);
      sendTelegramMessage(chatId, "⚠️ Hubo un error al consultar la base de datos.");
    });
  } else {
    sendTelegramMessage(chatId, `👋 Hola. Puedes preguntarme:\n\n• <i>"¿Cuántos invitados hay confirmados?"</i>\n• <i>"Lista de confirmados"</i>\n• <i>"/sincronizar"</i> (para actualizar desde el Excel de Google Drive)\n• <i>"/resumen"</i>\n\ny te responderé al instante.`);
  }
}

function pollUpdates() {
  if (!BOT_TOKEN) {
    console.warn("⚠️ pollUpdates en pausa: TELEGRAM_BOT_TOKEN no definido aún.");
    setTimeout(pollUpdates, 5000);
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;

  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.ok && Array.isArray(json.result)) {
          json.result.forEach(update => {
            lastUpdateId = update.update_id;
            if (update.message) {
              processMessage(update.message);
            }
          });
        }
      } catch (e) {
        console.error("Error parseando update:", e);
      }
      setTimeout(pollUpdates, 1000);
    });
  }).on('error', (err) => {
    console.error("Error de conexión con Telegram:", err.message);
    setTimeout(pollUpdates, 5000);
  });
}

// Servidor HTTP con soporte CORS y endpoint /api/notify para el frontend
const http = require('http');
const PORT = process.env.PORT || 8080;

http.createServer((req, res) => {
  // Encabezados CORS universales
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/notify') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.connection.destroy();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const { guestName, pasesMax, w, m, c, total } = data;

        // Esperar brevemente para que Firestore complete su persistencia antes de generar el reporte
        setTimeout(async () => {
          try {
            const report = await getConfirmationReport();
            const text = `🔔 <b>¡NUEVA CONFIRMACIÓN DE ASISTENCIA!</b>\n\n` +
              `👤 <b>Invitado:</b> ${guestName || 'Invitado'}\n` +
              `🎟️ <b>Pases considerados:</b> ${pasesMax || 0}\n` +
              `👥 <b>Asistirán:</b> ${total} persona(s)${total === 0 ? ' (Indicó que no asistirá)' : ''}\n` +
              `👨 <b>Hombres:</b> ${m || 0} | 👩 <b>Mujeres:</b> ${w || 0} | 🧒 <b>Niños:</b> ${c || 0}\n\n` +
              `━━━━━━━━━━━━━━━━━━━\n\n` +
              report;

            AUTHORIZED_CHAT_IDS.forEach(id => {
              sendTelegramMessage(id, text);
            });
          } catch (e) {
            console.error("Error al procesar notificación de confirmación:", e);
          }
        }, 1200);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'Notificación recibida' }));
      } catch (err) {
        console.error("Error procesando body de /api/notify:", err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Endpoint de salud / status
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🤖 Bot de Bautizo Catherine está activo 24/7.');
}).listen(PORT, () => {
  console.log(`🌐 Servidor HTTP activo en puerto ${PORT}`);
});

// Auto-sincronización periódica con Google Sheets cada 10 minutos
setInterval(async () => {
  try {
    const changes = await syncFromGoogleSheets();
    if (changes.agregados.length > 0 || changes.actualizados.length > 0 || changes.eliminados.length > 0) {
      let alertMsg = `📢 <b>¡Cambios detectados y sincronizados desde Google Sheets!</b>\n\n`;
      if (changes.agregados.length > 0) {
        alertMsg += `✨ <b>Nuevos agregados:</b>\n` + changes.agregados.map(a => `• ${a.nombre} (${a.qty} pases)`).join('\n') + `\n\n`;
      }
      if (changes.actualizados.length > 0) {
        alertMsg += `🔄 <b>Pases actualizados:</b>\n` + changes.actualizados.map(a => `• ${a.nombre} (${a.anterior} ➔ ${a.nuevo} pases)`).join('\n') + `\n\n`;
      }
      if (changes.eliminados.length > 0) {
        alertMsg += `🗑️ <b>Eliminados:</b>\n` + changes.eliminados.map(e => `• ${e}`).join('\n') + `\n\n`;
      }
      AUTHORIZED_CHAT_IDS.forEach(id => sendTelegramMessage(id, alertMsg));
    }
  } catch (err) {
    console.error("Error en auto-sincronización periódica:", err.message);
  }
}, 10 * 60 * 1000);

// Keep-Alive auto-ping para evitar que el contenedor gratuito de Render se suspenda (15 min inactividad)
const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || 'https://bot-bautizo.onrender.com';
setInterval(() => {
  try {
    const pingUrl = KEEP_ALIVE_URL.startsWith('http') ? `${KEEP_ALIVE_URL}/ping` : `https://${KEEP_ALIVE_URL}/ping`;
    https.get(pingUrl, (res) => {
      // Keep alive exitoso
    }).on('error', (err) => {
      // Ignorar errores transitorios durante deploys
    });
  } catch (err) {
    // Silencioso
  }
}, 8 * 60 * 1000); // Cada 8 minutos

console.log("🤖 Bot de Telegram activo y escuchando preguntas...");
pollUpdates();
