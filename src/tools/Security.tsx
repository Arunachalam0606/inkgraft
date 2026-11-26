import { Eye, EyeOff, Lock, Unlock as UnlockIcon } from 'lucide-react';
import { useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, Field, FileChip, inputCls } from '../components/ui';
import { baseName, download, formatBytes, readBytes } from '../lib/pdf';
import { isEncrypted, protect, unlock, type Perms } from '../lib/ops';

function PasswordInput({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <span className="relative block">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} autoComplete="new-password" className={`${inputCls} pr-11`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </Field>
  );
}

/** Rough strength: length plus character variety. Guidance only, not a guarantee. */
function strength(pw: string) {
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/, /\s/].filter((r) => r.test(pw)).length;
  const score = Math.min(4, Math.floor(pw.length / 4) + kinds - 1);
  return { score: Math.max(0, score), label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][Math.max(0, score)] };
}

function useFile() {
  const [file, setFile] = useState<File>();
  const [bytes, setBytes] = useState<Uint8Array>();
  const [locked, setLocked] = useState<boolean>();
  const [error, setError] = useState<string>();
  const take = async (f: File) => {
    setError(undefined);
    try { const b = await readBytes(f); setLocked(await isEncrypted(b)); setFile(f); setBytes(b); }
    catch { setError('That file couldn’t be read as a PDF.'); }
  };
  const clear = () => { setFile(undefined); setBytes(undefined); setLocked(undefined); };
  return { file, bytes, locked, error, setError, take, clear };
}

export function Protect() {
  const f = useFile();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [perms, setPerms] = useState<Perms>({ printing: true, copying: false, modifying: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const s = strength(pw);

  const run = async () => {
    if (!f.bytes || !f.file) return;
    setBusy(true); f.setError(undefined);
    try {
      const out = await protect(f.bytes, pw, perms);
      const name = `${baseName(f.file.name)}-protected.pdf`;
      download(out, name);
      setDone(`AES-256 · ${formatBytes(out.length)} · ${name}. Keep the password safe — it can’t be recovered.`);
    } catch (e) { f.setError(`Couldn’t encrypt: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const again = () => { f.clear(); setPw(''); setPw2(''); setDone(undefined); };

  if (!f.file) return <><Dropzone onFiles={([x]) => f.take(x)} /><ErrorNote error={f.error} /></>;
  if (f.locked) return <><FileChip file={f.file} onRemove={again} /><ErrorNote error="This PDF already has a password. Remove it first, then protect it again." /></>;
  const mismatch = pw2.length > 0 && pw !== pw2;
  return (
    <div>
      <FileChip file={f.file} onRemove={again} />
      <div className="mt-6 max-w-[560px] space-y-5 rounded-2xl border border-line bg-surface p-6">
        <PasswordInput label="Password to open the PDF" value={pw} onChange={setPw} autoFocus />
        <div className="flex items-center gap-3" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: i < s.score ? ['#f43f5e', '#f59e0b', '#84cc16', '#22c55e'][s.score - 1] : 'var(--line-strong)' }} />
            ))}
          </div>
          <span className="w-16 text-right text-[12px] text-muted">{pw ? s.label : ''}</span>
        </div>
        <PasswordInput label="Type it again" value={pw2} onChange={setPw2} />
        {mismatch && <p className="text-[13px] text-rose-400" role="alert">The passwords don’t match.</p>}
        <fieldset className="space-y-2.5">
          <legend className="mb-2 text-[13px] font-medium text-muted">After opening, people can…</legend>
          {([['printing', 'Print it'], ['copying', 'Copy text and images'], ['modifying', 'Edit pages and annotations']] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2.5 text-[14px]">
              <input type="checkbox" checked={perms[k]} onChange={(e) => setPerms((p) => ({ ...p, [k]: e.target.checked }))} className="size-4 accent-[var(--accent)]" />{label}
            </label>
          ))}
        </fieldset>
        <Button busy={busy} disabled={pw.length < 4 || pw !== pw2} onClick={run} className="w-full"><Lock className="size-4" />Protect PDF</Button>
        <p className="text-[12px] text-faint">Encrypted with AES-256 on your device. Permission limits are honoured by most readers but aren’t a hard guarantee.</p>
      </div>
      <ErrorNote error={f.error} />
      <Done show={!!done} title="Protected — downloading" detail={done} onAgain={again} />
    </div>
  );
}

export function Unlock() {
  const f = useFile();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();

  const run = async () => {
    if (!f.bytes || !f.file) return;
    setBusy(true); f.setError(undefined);
    try {
      const out = await unlock(f.bytes, pw);
      const name = `${baseName(f.file.name)}-unlocked.pdf`;
      download(out, name);
      setDone(`No password needed any more · ${formatBytes(out.length)} · ${name}`);
    } catch (e) { f.setError((e as Error).name === 'WrongPassword' ? (e as Error).message : `Couldn’t unlock: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const again = () => { f.clear(); setPw(''); setDone(undefined); };

  if (!f.file) return <><Dropzone onFiles={([x]) => f.take(x)} hint="Only for PDFs you’re allowed to open — you need the password." /><ErrorNote error={f.error} /></>;
  if (f.locked === false) return <><FileChip file={f.file} onRemove={again} /><p className="mt-4 text-muted">This PDF isn’t password-protected — there’s nothing to remove.</p></>;
  return (
    <div>
      <FileChip file={f.file} onRemove={again} />
      <form className="mt-6 max-w-[560px] space-y-5 rounded-2xl border border-line bg-surface p-6" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <PasswordInput label="Current password" value={pw} onChange={setPw} autoFocus />
        <Button type="submit" busy={busy} disabled={!pw} className="w-full"><UnlockIcon className="size-4" />Remove password</Button>
      </form>
      <ErrorNote error={f.error} />
      <Done show={!!done} title="Unlocked — downloading" detail={done} onAgain={again} />
    </div>
  );
}
