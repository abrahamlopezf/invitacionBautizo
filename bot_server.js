const https = require('https');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

const BOT_TOKEN = "8634708926:AAGOfHeqn7JEpZAfmoRLgWxTJ157YveHIKw";
const AUTHORIZED_CHAT_ID = "5215477099"; // Abraham Lopez

let lastUpdateId = 0;

function sendTelegramMessage(chatId, text) {
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

  if (chatId !== AUTHORIZED_CHAT_ID) {
    sendTelegramMessage(chatId, "🔒 Lo siento, este bot es privado para los organizadores del bautizo de Catherine.");
    return;
  }

  const text = msg.text.toLowerCase().trim();

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
    sendTelegramMessage(chatId, `👋 Hola Abraham. Puedes preguntarme:\n\n• <i>"¿Cuántos invitados hay confirmados?"</i>\n• <i>"Lista de confirmados"</i>\n• <i>"/resumen"</i>\n\ny te daré la lista en tabla con los totales actualizados en tiempo real.`);
  }
}

function pollUpdates() {
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
      // Siguiente ciclo de polling
      setTimeout(pollUpdates, 1000);
    });
  }).on('error', (err) => {
    console.error("Error de conexión con Telegram:", err.message);
    setTimeout(pollUpdates, 5000);
  });
}

// Servidor HTTP simple para mantener vivo el servicio en la nube (Render, Railway, etc.)
const http = require('http');
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🤖 Bot de Bautizo Catherine está activo 24/7.');
}).listen(PORT, () => {
  console.log(`🌐 Servidor HTTP activo en puerto ${PORT}`);
});

console.log("🤖 Bot de Telegram activo y escuchando preguntas...");
pollUpdates();
