/* =========================================================
   FlightBrief — synthèse vocale vers un fichier son (v1.9)
   ---------------------------------------------------------
   La synthèse vocale de Chromium parle toujours sur la sortie Windows par défaut :
   impossible de l'envoyer vers un casque, une sortie VoiceMeeter, etc. Ici, les voix
   SAPI de Windows (System.Speech) rendent la phrase en WAV ; le renderer la joue
   ensuite sur la sortie audio choisie (HTMLMediaElement.setSinkId).
   Un seul PowerShell reste ouvert (démarrage ~1 s, puis ~100 ms par phrase).
   Windows uniquement.
   ========================================================= */
const { spawn } = require('child_process');

// Une requête JSON par ligne (texte en base64 pour les accents), une réponse JSON par ligne.
const PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = @($s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo })
function Pick($name, $lang) {
  if ($name) {
    $v = $voices | Where-Object { $_.Name -eq $name } | Select-Object -First 1
    if (-not $v) { $w = ($name -split '[ -]+' | Where-Object { $_ -and $_ -ne 'Microsoft' -and $_ -ne 'Desktop' } | Select-Object -First 1); if ($w) { $v = $voices | Where-Object { $_.Name -like "*$w*" } | Select-Object -First 1 } }
    if ($v) { return $v }
  }
  if ($lang) { return $voices | Where-Object { $_.Culture.Name -like "$lang*" } | Select-Object -First 1 }
  return $null
}
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $id = 0
  try {
    $r = $line | ConvertFrom-Json
    $id = $r.id
    if ($r.cmd -eq 'voices') {
      $list = @($voices | ForEach-Object { @{ name = $_.Name; lang = $_.Culture.Name } })
      [Console]::Out.WriteLine((@{ id = $id; ok = $true; voices = $list } | ConvertTo-Json -Compress -Depth 4))
      continue
    }
    $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($r.text))
    $v = Pick $r.voice $r.lang
    if ($v) { $s.SelectVoice($v.Name) }
    $s.Rate = [int]$r.rate
    $s.Volume = 100
    $ms = New-Object System.IO.MemoryStream
    $s.SetOutputToWaveStream($ms)
    $s.Speak($text)
    $s.SetOutputToNull()
    [Console]::Out.WriteLine((@{ id = $id; ok = $true; wav = [Convert]::ToBase64String($ms.ToArray()) } | ConvertTo-Json -Compress))
    $ms.Dispose()
  } catch {
    [Console]::Out.WriteLine((@{ id = $id; ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress))
  }
}
`;

class Tts {
  constructor() { this.proc = null; this.buf = ''; this.pending = new Map(); this.seq = 0; }
  available() { return process.platform === 'win32'; }
  _start() {
    if (this.proc) return this.proc;
    const enc = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');
    const p = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc = p; this.buf = '';
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', d => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        if (!line.startsWith('{')) continue;
        let r; try { r = JSON.parse(line); } catch (e) { continue; }
        const cb = this.pending.get(r.id);
        if (cb) { this.pending.delete(r.id); cb(r); }
      }
    });
    p.stderr.on('data', () => { /* ignoré : les erreurs remontent en JSON */ });
    const fail = () => {
      if (this.proc !== p) return;
      this.proc = null;
      for (const cb of this.pending.values()) cb({ ok: false, error: 'tts process exited' });
      this.pending.clear();
    };
    p.on('exit', fail); p.on('error', fail);
    return p;
  }
  _send(req, timeoutMs) {
    if (!this.available()) return Promise.resolve({ ok: false, error: 'unsupported' });
    const p = this._start(), id = ++this.seq;
    return new Promise(resolve => {
      const t = setTimeout(() => { if (this.pending.delete(id)) resolve({ ok: false, error: 'timeout' }); }, timeoutMs || 15000);
      this.pending.set(id, r => { clearTimeout(t); resolve(r); });
      try { p.stdin.write(JSON.stringify({ id, ...req }) + '\n'); } catch (e) { this.pending.delete(id); clearTimeout(t); resolve({ ok: false, error: e.message }); }
    });
  }
  // rate : débit Chromium (0,5 à 2) ramené à l'échelle SAPI (-10 à 10).
  async speak(text, opts) {
    opts = opts || {};
    const rate = Math.max(-10, Math.min(10, Math.round(((+opts.rate || 1) - 1) * 10)));
    const r = await this._send({ text: Buffer.from(String(text || '').slice(0, 1000), 'utf8').toString('base64'), voice: String(opts.voice || ''), lang: String(opts.lang || '').slice(0, 2), rate });
    return r.ok ? { ok: true, wav: r.wav } : { ok: false, error: r.error || 'error' };
  }
  async voices() { const r = await this._send({ cmd: 'voices' }); return r.ok ? (r.voices || []) : []; }
  warm() { if (this.available()) this._start(); }
  stop() { if (this.proc) { try { this.proc.stdin.end(); this.proc.kill(); } catch (e) { /* ignoré */ } this.proc = null; } }
}

module.exports = { Tts };
