/* =========================================================
   FlightBrief — HTTPS local pour le compagnon mobile (v1.3.1)
   ---------------------------------------------------------
   Pourquoi : un téléphone n'accepte d'installer une appli web capable de s'ouvrir
   SANS réseau (service worker + stockage persistant) que si elle est servie en HTTPS.
   On crée donc, une fois pour toutes sur ce PC :
     • une petite autorité de certification (CA) propre à ce PC, que l'utilisateur
       approuve une seule fois sur son téléphone ;
     • un certificat serveur signé par cette CA, pour "flightbrief.local" + les IP
       locales du PC (ré-émis automatiquement si l'IP du PC change).
   Sécurité : la CA porte une contrainte de nom (Name Constraints, critique) qui ne
   l'autorise à signer QUE pour flightbrief.local, localhost et les plages d'adresses
   privées (10/8, 172.16/12, 192.168/16, 127/8). Même si sa clé fuitait, elle ne
   permettrait pas d'usurper un vrai site web sur le téléphone.

   + un mini répondeur mDNS (Bonjour) qui annonce "flightbrief.local" sur le réseau :
   l'adresse de l'appli installée ne change pas si l'IP du PC change.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const HOSTNAME = 'flightbrief.local';
const LEAF_VALIDITY_DAYS = 390; // < 398 j : plafond accepté par iOS pour un certificat serveur

let forge = null;
function getForge() { if (!forge) forge = require('node-forge'); return forge; }

function isPrivateIPv4(ip) {
  return /^(10\.|192\.168\.|127\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

// IPv4 privées de ce PC (hors cartes virtuelles connues), les plus probables d'abord.
function localIPv4s() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(name => (ifaces[name] || []).forEach(i => {
    const fam = typeof i.family === 'string' ? i.family : (i.family === 4 ? 'IPv4' : 'IPv6');
    if (fam !== 'IPv4' || i.internal || !isPrivateIPv4(i.address)) return;
    const virtual = /vethernet|virtualbox|vmware|wsl|hyper-v|docker|loopback|tailscale|zerotier/i.test(name);
    out.push({ name, address: i.address, virtual });
  }));
  return out.sort((a, b) => (a.virtual - b.virtual));
}

function randomSerial() {
  const b = crypto.randomBytes(16);
  b[0] &= 0x7f; // entier positif
  return b.toString('hex');
}

// Extension "Name Constraints" (OID 2.5.29.30) construite à la main en ASN.1.
function nameConstraintsExtension() {
  const f = getForge(), A = f.asn1;
  const subtree = base => A.create(A.Class.UNIVERSAL, A.Type.SEQUENCE, true, [base]);
  const dns = name => subtree(A.create(A.Class.CONTEXT_SPECIFIC, 2, false, name));
  const ipRange = (ip, mask) => subtree(A.create(A.Class.CONTEXT_SPECIFIC, 7, false,
    String.fromCharCode(...ip.split('.').map(Number), ...mask.split('.').map(Number))));
  const permitted = A.create(A.Class.CONTEXT_SPECIFIC, 0, true, [
    dns(HOSTNAME), dns('localhost'),
    ipRange('10.0.0.0', '255.0.0.0'), ipRange('172.16.0.0', '255.240.0.0'),
    ipRange('192.168.0.0', '255.255.0.0'), ipRange('127.0.0.0', '255.0.0.0')
  ]);
  return { id: '2.5.29.30', critical: true, value: A.create(A.Class.UNIVERSAL, A.Type.SEQUENCE, true, [permitted]) };
}

function createCA() {
  const f = getForge(), pki = f.pki;
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 10 * 365 * 86400000);
  // ASCII uniquement : node-forge encode mal l'UTF-8 dans les noms de certificat.
  const host = (os.hostname() || 'PC').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 30) || 'PC';
  const attrs = [
    { name: 'commonName', value: `FlightBrief local - ${host} (${crypto.randomBytes(2).toString('hex')})` },
    { name: 'organizationName', value: 'FlightBrief (usage local uniquement)' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true, critical: true },
    { name: 'subjectKeyIdentifier' },
    nameConstraintsExtension()
  ]);
  cert.sign(keys.privateKey, f.md.sha256.create());
  return { certPem: pki.certificateToPem(cert), keyPem: pki.privateKeyToPem(keys.privateKey) };
}

function createLeaf(ca, leafKeyPem, ips) {
  const f = getForge(), pki = f.pki;
  const caCert = pki.certificateFromPem(ca.certPem);
  const caKey = pki.privateKeyFromPem(ca.keyPem);
  const leafKey = pki.privateKeyFromPem(leafKeyPem);
  const cert = pki.createCertificate();
  cert.publicKey = pki.setRsaPublicKey(leafKey.n, leafKey.e);
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + LEAF_VALIDITY_DAYS * 86400000);
  cert.setSubject([{ name: 'commonName', value: HOSTNAME }]);
  cert.setIssuer(caCert.subject.attributes);
  const altNames = [{ type: 2, value: HOSTNAME }, { type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }]
    .concat(ips.map(ip => ({ type: 7, ip })));
  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', keyIdentifier: caCert.generateSubjectKeyIdentifier().getBytes() }
  ]);
  cert.sign(caKey, f.md.sha256.create());
  return pki.certificateToPem(cert);
}

/* ---------------- Gestion sur disque ---------------- */
class LocalTls {
  constructor(dir) {
    this.dir = dir;
    this._cache = null;
  }
  _p(n) { return path.join(this.dir, n); }
  _read(n) { try { return fs.readFileSync(this._p(n), 'utf-8'); } catch (e) { return null; } }
  _write(n, v) { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this._p(n), v, 'utf-8'); }

  ensureCA() {
    let certPem = this._read('ca-cert.pem'), keyPem = this._read('ca-key.pem');
    if (!certPem || !keyPem) {
      ({ certPem, keyPem } = createCA());
      this._write('ca-key.pem', keyPem);
      this._write('ca-cert.pem', certPem);
      // Nouvelle CA -> l'ancien certificat serveur n'est plus valable.
      try { fs.unlinkSync(this._p('cert.pem')); } catch (e) { /* absent */ }
    }
    return { certPem, keyPem };
  }

  // Certificat serveur à jour pour les IP actuelles (ré-émis si une IP est apparue ou
  // si l'échéance approche). Retourne { key, cert, ca, changed }.
  ensureServerCert() {
    const ca = this.ensureCA();
    let leafKey = this._read('key.pem');
    if (!leafKey) {
      const f = getForge();
      leafKey = f.pki.privateKeyToPem(f.pki.rsa.generateKeyPair(2048).privateKey);
      this._write('key.pem', leafKey);
      try { fs.unlinkSync(this._p('cert.pem')); } catch (e) { /* absent */ }
    }
    const ips = localIPv4s().map(i => i.address);
    let meta = {};
    try { meta = JSON.parse(this._read('meta.json') || '{}'); } catch (e) { meta = {}; }
    let cert = this._read('cert.pem');
    const known = new Set(meta.ips || []);
    const missingIp = ips.some(ip => !known.has(ip));
    const expiresSoon = !meta.notAfter || (new Date(meta.notAfter) - Date.now()) < 30 * 86400000;
    let changed = false;
    if (!cert || missingIp || expiresSoon) {
      // On garde aussi les anciennes IP (utile si le PC alterne Wi-Fi / Ethernet).
      const allIps = Array.from(new Set([...ips, ...(meta.ips || [])])).slice(0, 12);
      cert = createLeaf(ca, leafKey, allIps);
      this._write('cert.pem', cert);
      this._write('meta.json', JSON.stringify({ ips: allIps, notAfter: new Date(Date.now() + LEAF_VALIDITY_DAYS * 86400000).toISOString() }));
      changed = true;
    }
    return { key: leafKey, cert, ca: ca.certPem, changed };
  }

  caDer() {
    const f = getForge();
    const ca = this.ensureCA();
    return Buffer.from(f.asn1.toDer(f.pki.certificateToAsn1(f.pki.certificateFromPem(ca.certPem))).getBytes(), 'binary');
  }
  caFingerprint() {
    return crypto.createHash('sha256').update(this.caDer()).digest('hex').toUpperCase().match(/.{2}/g).join(':');
  }
  caName() {
    const f = getForge();
    const c = f.pki.certificateFromPem(this.ensureCA().certPem);
    const cn = c.subject.getField('CN');
    return cn ? cn.value : 'FlightBrief local';
  }
}

/* ---------------- Répondeur mDNS : flightbrief.local -> IP du PC ---------------- */
function startMdnsResponder(onError) {
  let mdns;
  try { mdns = require('multicast-dns')({ reuseAddr: true, loopback: true }); }
  catch (e) { if (onError) onError(e); return null; }
  mdns.on('error', err => { if (onError) onError(err); });
  mdns.on('query', (query, rinfo) => {
    const asksUs = (query.questions || []).some(q => q.name && q.name.toLowerCase() === HOSTNAME && (q.type === 'A' || q.type === 'ANY'));
    if (!asksUs) return;
    // Réponse avec l'IP du PC située dans le même sous-réseau que le demandeur si possible.
    const ips = localIPv4s().map(i => i.address);
    const sameNet = ips.filter(ip => rinfo && rinfo.address && ip.split('.').slice(0, 3).join('.') === rinfo.address.split('.').slice(0, 3).join('.'));
    const answers = (sameNet.length ? sameNet : ips).map(ip => ({ name: HOSTNAME, type: 'A', ttl: 120, class: 'IN', flush: true, data: ip }));
    if (answers.length) mdns.respond({ answers });
  });
  return mdns;
}

module.exports = { LocalTls, startMdnsResponder, localIPv4s, HOSTNAME };
