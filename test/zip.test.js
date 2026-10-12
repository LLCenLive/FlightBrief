// Archive ZIP du plugin Stream Deck : relue par l'outil système « unzip » : node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { zip, crc32 } = require('../zip');

test('crc32 de référence', () => assert.strictEqual(crc32(Buffer.from('123456789')), 0xCBF43926));

test('zip lisible et contenu intact (noms accentués compris)', { skip: !fs.existsSync('/usr/bin/unzip') && 'unzip absent' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbzip-')), file = path.join(dir, 't.streamDeckPlugin');
  fs.writeFileSync(file, zip([{ name: 'a.sdPlugin/manifest.json', data: Buffer.from('{"Name":"FlightBrief"}') }, { name: 'a.sdPlugin/images/é.txt', data: Buffer.alloc(5000, 'x') }]));
  assert.match(execFileSync('unzip', ['-t', file]).toString(), /No errors detected/);
  assert.strictEqual(execFileSync('unzip', ['-p', file, 'a.sdPlugin/manifest.json']).toString(), '{"Name":"FlightBrief"}');
});
