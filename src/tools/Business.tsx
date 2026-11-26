import { AnimatePresence, motion } from 'motion/react';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Done, ErrorNote, Field, Group, Segmented, inputCls } from '../components/ui';
import { PreviewPane } from '../components/pages';
import { download, formatBytes, openPdf, renderPage } from '../lib/pdf';
import { computeInvoice, inWords, money, validGstin, type Item } from '../lib/gst';
import { invoicePdf, receiptPdf, type Party } from '../lib/invoicePdf';

// per-device memory of your own business details (never leaves the browser)
const remember = <T,>(k: string, d: T): [T, (v: T) => void] => {
  let init = d;
  try { const s = localStorage.getItem(k); if (s) init = { ...d, ...JSON.parse(s) }; } catch { /* private mode */ }
  return [init, (v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not saved */ } }];
};
const today = () => new Date().toLocaleDateString('en-GB');
const blankItem = (): Item => ({ name: '', hsn: '', qty: 1, rate: 0, gst: 18 });

function usePdfPreview(make: () => Promise<Uint8Array>, key: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let a = true;
    const t = setTimeout(async () => { try { const d = await openPdf(await make()); const c = await renderPage(d, 1, { width: 520 }); void d.loadingTask.destroy(); if (a) setUrl(c.toDataURL('image/jpeg', 0.86)); } catch { /* keep the last preview */ } }, 260);
    return () => { a = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

function Items({ items, set, inclusive }: { items: Item[]; set: (i: Item[]) => void; inclusive?: boolean }) {
  const up = (k: number, patch: Partial<Item>) => set(items.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_80px_56px_84px_64px_28px] gap-2 px-1 text-[11.5px] text-faint sm:grid"><span>Item</span><span>HSN/SAC</span><span>Qty</span><span>{inclusive ? 'Price' : 'Rate'}</span><span>GST %</span><span /></div>
      <AnimatePresence initial={false}>
        {items.map((it, k) => (
          <motion.div key={k} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_80px_56px_100px_70px_28px]">
            <input aria-label="Item" value={it.name} onChange={(e) => up(k, { name: e.target.value })} placeholder="Item or service" className={`${inputCls} col-span-2 sm:col-span-1`} />
            <input aria-label="HSN or SAC" value={it.hsn} onChange={(e) => up(k, { hsn: e.target.value.replace(/\D/g, '').slice(0, 8) })} placeholder="HSN" className={inputCls} />
            <input aria-label="Quantity" type="number" min={0} value={it.qty} onChange={(e) => up(k, { qty: +e.target.value })} className={inputCls} />
            <input aria-label={inclusive ? 'Price incl. GST' : 'Rate'} type="number" min={0} step="0.01" value={it.rate || ''} onChange={(e) => up(k, { rate: +e.target.value })} placeholder="0.00" className={inputCls} />
            <select aria-label="GST rate" value={it.gst} onChange={(e) => up(k, { gst: +e.target.value })} className={inputCls}>{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}</select>
            <button aria-label="Remove item" onClick={() => set(items.filter((_, i) => i !== k))} disabled={items.length === 1} className="grid place-items-center rounded-lg text-faint hover:text-rose-400 disabled:opacity-30"><Trash2 className="size-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button variant="ghost" onClick={() => set([...items, blankItem()])}><Plus className="size-4" />Add item</Button>
    </div>
  );
}

function PartyFields({ label, p, set }: { label: string; p: Party; set: (p: Party) => void }) {
  const bad = p.gstin && !validGstin(p.gstin);
  return (
    <fieldset className="space-y-3"><legend className="mb-2 text-[13px] font-medium text-muted">{label}</legend>
      <input aria-label={`${label} name`} value={p.name} onChange={(e) => set({ ...p, name: e.target.value })} placeholder="Business name" className={inputCls} />
      <textarea aria-label={`${label} address`} value={p.address} onChange={(e) => set({ ...p, address: e.target.value })} placeholder="Address" rows={2} className={`${inputCls} resize-none`} />
      <div className="grid grid-cols-2 gap-2">
        <input aria-label={`${label} GSTIN`} value={p.gstin} onChange={(e) => set({ ...p, gstin: e.target.value.toUpperCase().slice(0, 15) })} placeholder="GSTIN (optional)" className={`${inputCls} font-mono ${bad ? 'border-rose-400' : ''}`} />
        <input aria-label={`${label} state`} value={p.state} onChange={(e) => set({ ...p, state: e.target.value })} placeholder="State" className={inputCls} />
      </div>
      {bad && <p className="text-[12px] text-rose-400">That GSTIN’s checksum doesn’t match — check for a typo.</p>}
    </fieldset>
  );
}

export function GstInvoice() {
  const [initSeller, saveSeller] = useMemo(() => remember<Party & { bank: string }>('ig.seller', { name: '', address: '', gstin: '', state: '', bank: '' }), []);
  const [seller, setSeller] = useState(initSeller);
  const [buyer, setBuyer] = useState<Party>({ name: '', address: '', gstin: '', state: '' });
  const [number, setNumber] = useState('INV-001');
  const [date, setDate] = useState(today());
  const [items, setItems] = useState<Item[]>([{ name: 'Professional services', hsn: '998313', qty: 1, rate: 10000, gst: 18 }]);
  const [manualInter, setManualInter] = useState<'auto' | 'intra' | 'inter'>('auto');
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();
  // GSTIN's first two digits are the state code: different codes mean inter-state supply
  const autoInter = !!(seller.gstin.length >= 2 && buyer.gstin.length >= 2 && seller.gstin.slice(0, 2) !== buyer.gstin.slice(0, 2)) || (!!seller.state && !!buyer.state && seller.state.trim().toLowerCase() !== buyer.state.trim().toLowerCase());
  const inter = manualInter === 'auto' ? autoInter : manualInter === 'inter';
  const t = computeInvoice(items, inter);
  const data = { seller, buyer, number, date, items, interState: inter, bank: seller.bank };
  const url = usePdfPreview(async () => (await invoicePdf(data)).bytes, JSON.stringify(data));
  const save = async () => {
    try {
      const { bytes } = await invoicePdf(data);
      saveSeller(seller);
      download(bytes, `${number.replace(/[^\w-]+/g, '_')}.pdf`);
      setDone(`Total Rs. ${money(t.grand)} · ${formatBytes(bytes.length)}`);
      setNumber((n) => n.replace(/(\d+)(?!.*\d)/, (d) => String(+d + 1).padStart(d.length, '0'))); // ready for the next invoice
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-6 rounded-2xl border border-line bg-surface p-5">
        <div className="grid gap-6 md:grid-cols-2"><PartyFields label="From (you)" p={seller} set={(p) => setSeller({ ...seller, ...p })} /><PartyFields label="Bill to" p={buyer} set={setBuyer} /></div>
        <div className="flex flex-wrap gap-3">
          <Field label="Invoice no."><input value={number} onChange={(e) => setNumber(e.target.value)} className={`${inputCls} max-w-40`} /></Field>
          <Field label="Date"><input value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} max-w-36`} /></Field>
          <Group label="Supply"><Segmented id="supply" value={manualInter} onChange={setManualInter} options={[{ value: 'auto', label: `Auto (${autoInter ? 'IGST' : 'CGST+SGST'})` }, { value: 'intra', label: 'Intra' }, { value: 'inter', label: 'Inter' }]} /></Group>
        </div>
        <Items items={items} set={setItems} />
        <Field label="Bank details (printed on the invoice)"><input value={seller.bank} onChange={(e) => setSeller({ ...seller, bank: e.target.value })} placeholder="Bank, account, IFSC" className={inputCls} /></Field>
        <div className="rounded-xl bg-bg p-4 text-[14px]">
          <div className="flex justify-between text-muted"><span>Taxable</span><span className="tabular-nums">Rs. {money(t.taxable)}</span></div>
          {inter ? <div className="flex justify-between text-muted"><span>IGST</span><span className="tabular-nums">Rs. {money(t.igst)}</span></div>
            : <><div className="flex justify-between text-muted"><span>CGST</span><span className="tabular-nums">Rs. {money(t.cgst)}</span></div><div className="flex justify-between text-muted"><span>SGST</span><span className="tabular-nums">Rs. {money(t.sgst)}</span></div></>}
          <div className="mt-2 flex justify-between text-[18px] font-semibold"><span>Total</span><span className="tabular-nums">Rs. {money(t.grand)}</span></div>
          <p className="mt-1 text-[12px] text-faint">{inWords(t.grand)}</p>
        </div>
        <Button onClick={save} disabled={!seller.name || !buyer.name || !t.lines.length} className="w-full">Download invoice</Button>
        <ErrorNote error={error} />
        <Done show={!!done} title="Invoice saved — downloading" detail={done} onAgain={() => setDone(undefined)} />
      </div>
      <PreviewPane url={url} label="Live preview" />
    </div>
  );
}

export function PosBill() {
  const [initShop, saveShop] = useMemo(() => remember('ig.shop', { shop: '', address: '', gstin: '', footer: 'Goods once sold will not be taken back.' }), []);
  const [shop, setShop] = useState(initShop);
  const [items, setItems] = useState<Item[]>([{ name: 'Tea', hsn: '0902', qty: 2, rate: 15, gst: 5 }, { name: 'Biscuits', hsn: '1905', qty: 1, rate: 30, gst: 18 }]);
  const [incl, setIncl] = useState(true);
  const [pay, setPay] = useState('Cash');
  const [no, setNo] = useState(1);
  const [done, setDone] = useState<string>();
  const data = { ...shop, number: String(no), date: new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }), items, gstInclusive: incl, payment: pay };
  const url = usePdfPreview(async () => (await receiptPdf(data)).bytes, JSON.stringify({ ...data, date: '' }));
  const save = async () => {
    const { bytes, totals } = await receiptPdf(data);
    saveShop(shop);
    download(bytes, `bill-${no}.pdf`);
    setDone(`Bill ${no} · Rs. ${money(totals.grand)}`); setNo((n) => n + 1);
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <input aria-label="Shop name" value={shop.shop} onChange={(e) => setShop({ ...shop, shop: e.target.value })} placeholder="Shop name" className={inputCls} />
          <input aria-label="Shop GSTIN" value={shop.gstin} onChange={(e) => setShop({ ...shop, gstin: e.target.value.toUpperCase().slice(0, 15) })} placeholder="GSTIN (optional)" className={`${inputCls} font-mono`} />
          <input aria-label="Shop address" value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })} placeholder="Address" className={`${inputCls} md:col-span-2`} />
        </div>
        <Items items={items} set={setItems} inclusive={incl} />
        <div className="flex flex-wrap gap-4">
          <Group label="Prices"><Segmented id="incl" value={incl ? 'in' : 'ex'} onChange={(v) => setIncl(v === 'in')} options={[{ value: 'in', label: 'Include GST' }, { value: 'ex', label: 'Plus GST' }]} /></Group>
          <Group label="Paid by"><Segmented id="pay" value={pay} onChange={setPay} options={['Cash', 'UPI', 'Card'].map((p) => ({ value: p, label: p }))} /></Group>
          <Field label="Bill no."><input type="number" min={1} value={no} onChange={(e) => setNo(+e.target.value)} className={`${inputCls} max-w-24`} /></Field>
        </div>
        <input aria-label="Footer note" value={shop.footer} onChange={(e) => setShop({ ...shop, footer: e.target.value })} placeholder="Footer note" className={inputCls} />
        <Button onClick={save} disabled={!shop.shop} className="w-full">Download bill (80 mm)</Button>
        <Done show={!!done} title="Bill saved — downloading" detail={done} onAgain={() => setDone(undefined)} />
      </div>
      <PreviewPane url={url} label="Receipt preview" />
    </div>
  );
}
