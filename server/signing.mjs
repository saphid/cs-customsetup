// Signs what stations execute or apply: the station script and each profile
// bundle. The public key is baked into the launcher and the script, so a
// response altered on the way (plain HTTP on a venue LAN) fails verification.
import { generateKeyPairSync, createPrivateKey, createPublicKey, createHash, sign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
const b64 = (base64url) => Buffer.from(base64url, 'base64url').toString('base64');

export class Signer {
  // file: PEM private key, created on first use. Without a file the key lives
  // in memory only (tests), and stations must re-download after a restart.
  constructor(file) {
    let pem;
    if (file && existsSync(file)) pem = readFileSync(file, 'utf8');
    else {
      ({ privateKey: pem } = generateKeyPairSync('rsa', { modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }));
      if (file) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, pem, { mode: 0o600 }); }
    }
    this.key = createPrivateKey(pem);
    const pub = createPublicKey(this.key);
    const { n, e } = pub.export({ format: 'jwk' });
    // .NET's RSACryptoServiceProvider.FromXmlString format (Windows PowerShell 5.1).
    this.publicXml = `<RSAKeyValue><Modulus>${b64(n)}</Modulus><Exponent>${b64(e)}</Exponent></RSAKeyValue>`;
    const der = pub.export({ type: 'spki', format: 'der' });
    // Short fingerprint for admins to compare: the admin page, the server log and the station window show it.
    this.fingerprint = sha256Hex(der).slice(0, 16).toUpperCase().match(/.{4}/g).join('-');
  }

  // RSA PKCS#1 v1.5 with SHA-256, base64: what .NET's VerifyData(bytes, 'SHA256', sig) checks.
  sign(bytes) { return sign('sha256', bytes, this.key).toString('base64'); }
}
