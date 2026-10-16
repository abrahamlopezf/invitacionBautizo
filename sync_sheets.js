const https = require('https');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, addDoc } = require('firebase/firestore');

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

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1OS9itMb3pqKLhjtEHDnaL9UuOsKFl2nenqHp_loYKFw/export?format=csv';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 302 || res.statusCode === 307) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function normalizeName(str) {
  if (!str) return "";
  let norm = str
    .toUpperCase()
    .trim()
    .replace(/[ÁÀÄ]/g, "A")
    .replace(/[ÉÈË]/g, "E")
    .replace(/[ÍÌÏ]/g, "I")
    .replace(/[ÓÒÖ]/g, "O")
    .replace(/[ÚÙÜ]/g, "U")
    .replace(/\s+/g, " ");

  // Reglas especiales
  if (norm === "JUAN") norm = "JUAN SANTILLAN";
  return norm;
}

async function syncFromGoogleSheets() {
  console.log("Descargando Google Sheets en tiempo real...");
  const rawCsv = await fetchUrl(SHEET_CSV_URL);
  const lines = rawCsv.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length <= 1) {
    throw new Error("El archivo de Google Sheets parece estar vacío o no contiene datos.");
  }

  // 1. Parsear el CSV (Columnas: 0=nombre, 1=cantidad_considerada)
  const targetMap = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const rawName = parts[0] ? parts[0].trim() : '';
    const rawQty = parts[1] ? parseInt(parts[1].trim(), 10) : 0;

    if (!rawName || isNaN(rawQty) || rawQty <= 0) continue;

    const norm = normalizeName(rawName);
    // Si ya existe (ej. duplicados en el excel), conservamos la primera o mayor
    if (!targetMap[norm] || targetMap[norm].qty < rawQty) {
      targetMap[norm] = {
        originalName: rawName,
        qty: rawQty
      };
    }
  }

  const targetNames = Object.keys(targetMap);
  console.log(`Invitados únicos encontrados en el Excel: ${targetNames.length}`);

  // 2. Obtener lista actual de Firestore
  const snapshot = await getDocs(collection(db, 'invitados'));
  const currentDocs = {};
  snapshot.forEach(d => {
    const data = d.data();
    currentDocs[data.nombre] = { id: d.id, ...data };
  });

  const changes = {
    agregados: [],
    actualizados: [],
    eliminados: [],
    sinCambios: 0
  };

  // 3. Procesar eliminados (están en Firestore pero no en el Excel)
  // Omitimos el alias 'LIZ PENA' si existe para no borrarlo por accidente
  for (const dbName in currentDocs) {
    if (dbName === 'LIZ PENA') continue;

    if (!targetMap[dbName]) {
      const docData = currentDocs[dbName];
      // Si ya confirmó asistencia, advertir o conservar para no perder confirmaciones
      if (docData.estado === 'Confirmado' || (docData.total_asistiran && docData.total_asistiran > 0)) {
        console.log(`⚠️ Conservando ${dbName} porque ya tiene confirmación activa.`);
      } else {
        await deleteDoc(doc(db, 'invitados', docData.id));
        changes.eliminados.push(dbName);
        console.log(`🗑️ Eliminado: ${dbName}`);
      }
    }
  }

  // 4. Procesar agregados y actualizaciones de pases
  for (const normName in targetMap) {
    const target = targetMap[normName];
    const existing = currentDocs[normName];

    if (existing) {
      if (existing.cantidad_considerada !== target.qty) {
        await updateDoc(doc(db, 'invitados', existing.id), {
          cantidad_considerada: target.qty
        });
        changes.actualizados.push({ nombre: normName, anterior: existing.cantidad_considerada, nuevo: target.qty });
        console.log(`🔄 Actualizado: ${normName} (${existing.cantidad_considerada} -> ${target.qty} pases)`);
      } else {
        changes.sinCambios++;
      }
    } else {
      await addDoc(collection(db, 'invitados'), {
        nombre: normName,
        cantidad_considerada: target.qty
      });
      changes.agregados.push({ nombre: normName, qty: target.qty });
      console.log(`✨ Agregado: ${normName} (${target.qty} pases)`);
    }
  }

  console.log("\n--- RESUMEN DE SINCRONIZACIÓN ---");
  console.log(`Agregados: ${changes.agregados.length}`);
  console.log(`Actualizados: ${changes.actualizados.length}`);
  console.log(`Eliminados: ${changes.eliminados.length}`);
  console.log(`Sin cambios: ${changes.sinCambios}`);

  return changes;
}

if (require.main === module) {
  syncFromGoogleSheets()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("Error en sincronización:", err);
      process.exit(1);
    });
}

module.exports = { syncFromGoogleSheets };
