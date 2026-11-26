import { motion, LayoutGroup } from 'motion/react';
import { ArrowRight, Search, ShieldCheck, WifiOff, BadgeCheck, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import Aurora from '../components/reactbits/Aurora';
import BlurText from '../components/reactbits/BlurText';
import ShinyText from '../components/reactbits/ShinyText';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import { CATEGORIES, FEATURED, TOOLS, toolById, type CategoryId, type Tool } from '../lib/registry';
import { theme } from '../lib/prefs';
import { openTool } from '../components/CommandPalette';
import { ToolRow } from '../components/ToolRow';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const ease = [0.16, 1, 0.3, 1] as const;

const TRUST = [
  { icon: ShieldCheck, text: 'Files never leave your device' },
  { icon: UserX, text: 'No sign-up' },
  { icon: BadgeCheck, text: 'No watermark' },
  { icon: WifiOff, text: 'Works offline once loaded' },
];

function Hero({ onSearch }: { onSearch: () => void }) {
  const th = theme.use();
  return (
    <section className="relative isolate overflow-hidden rounded-b-[28px] px-6 pt-20 pb-16 sm:px-10 lg:pt-28">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] opacity-45 [mask-image:radial-gradient(70%_80%_at_60%_0%,black,transparent)]">
        <Aurora colorStops={th === 'dark' ? ['#3b4fd8', '#7c93ff', '#2a2f6e'] : ['#b9c6ff', '#dfe5ff', '#c7d0ff']} amplitude={0.9} blend={0.55} speed={0.6} lightMode={th === 'light'} />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/60 px-3 py-1 text-[12.5px] backdrop-blur">
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
        {/* ShinyText paints on a canvas: it needs real colours, not CSS variables */}
        <ShinyText text="New · edit scanned PDFs in their own typeface" color={th === 'dark' ? '#8f97a6' : '#5b626e'} shineColor={th === 'dark' ? '#ffffff' : '#121417'} speed={3} />
      </motion.div>

      <h1 className="max-w-[16ch] text-[clamp(2.6rem,6.2vw,5.2rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
        <BlurText text="Every PDF tool." className="block" delay={60} animateBy="words" direction="top" trigger="load" />
        <span className="block font-serif text-[1.08em] font-normal tracking-[-0.02em] text-ink italic">
          <BlurText text="Nothing uploaded." delay={70} animateBy="words" direction="bottom" trigger="load" />
        </span>
      </h1>

      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45, ease }}
        className="mt-6 max-w-[56ch] text-[17px] leading-relaxed text-muted">
        Merge, split, compress, sign, protect and convert — and edit <em className="text-fg not-italic">scanned</em> pages using letters
        cloned from the scan itself. Everything runs in your browser, so your documents stay yours.
      </motion.p>

      <motion.button
        onClick={onSearch} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55, ease }}
        whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
        className="group mt-9 flex w-full max-w-[640px] items-center gap-3 rounded-2xl border border-line-strong bg-surface/80 px-5 py-4 text-left text-[15px] text-faint shadow-[0_20px_60px_-30px_var(--glow)] backdrop-blur transition-colors hover:border-accent/50"
      >
        <Search className="size-[18px]" />
        <span className="flex-1">Search {TOOLS.length} tools — try “merge” or “scan”</span>
        <kbd className="rounded-md border border-line px-2 py-0.5 text-[12px]">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </motion.button>

      <motion.ul initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.06, delayChildren: 0.7 } } }} className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
        {TRUST.map(({ icon: Icon, text }) => (
          <motion.li key={text} variants={{ h: { opacity: 0, y: 6 }, s: { opacity: 1, y: 0 } }} className="flex items-center gap-2 text-[13px] text-muted">
            <Icon className="size-4 text-ink" strokeWidth={1.75} />{text}
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

function Featured() {
  const th = theme.use();
  const tools = FEATURED.map(toolById).filter(Boolean) as Tool[];
  return (
    <section className="px-6 sm:px-10">
      <h2 className="mb-4 text-[13px] font-medium text-faint">Start with</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tools.map((tool, i) => {
          const Icon = tool.icon;
          const hero = i === 0;
          return (
            <motion.div key={tool.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.05, ease }} className={hero ? 'col-span-2 row-span-2' : ''}>
              <SpotlightCard theme={th} spotlightColor={th === 'dark' ? 'rgba(124,147,255,0.22)' : 'rgba(47,79,216,0.14)'}
                className={`h-full !rounded-2xl !border-line !bg-surface ${hero ? '!p-7' : '!p-5'}`}>
                <button onClick={() => openTool(tool)} className="group flex h-full w-full flex-col text-left after:absolute after:inset-0">
                  <span className={`grid place-items-center rounded-xl border border-line bg-bg ${hero ? 'size-12' : 'size-10'}`}>
                    <Icon className={hero ? 'size-[22px] text-ink' : 'size-[18px]'} strokeWidth={1.75} />
                  </span>
                  {hero && (
                    <span className="mt-6 max-w-[40ch] text-[15px] leading-relaxed text-muted">
                      Change a date, an amount or a name on a scanned bill and it looks like it was printed that way —
                      same typeface, same faded ink, same tilt.
                    </span>
                  )}
                  <span className={`mt-auto flex items-center gap-2 pt-8 font-medium tracking-tight ${hero ? 'text-[24px]' : 'text-[15px]'}`}>
                    {tool.name}
                    {!tool.ready && <span className="rounded-full border border-line px-1.5 text-[10px] font-normal text-faint">Soon</span>}
                    <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                  </span>
                </button>
              </SpotlightCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function AllTools() {
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const groups = useMemo(() => CATEGORIES.filter((c) => cat === 'all' || c.id === cat).map((c) => ({ ...c, tools: TOOLS.filter((t) => t.category === c.id) })), [cat]);
  return (
    <section className="px-6 pt-20 pb-24 sm:px-10" id="tools">
      <h2 className="text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-[-0.035em]">All tools</h2>
      <p className="mt-2 text-muted">{TOOLS.filter((t) => t.ready).length} ready now, more landing every week. No limits, no watermark, no account.</p>

      <LayoutGroup>
        <div className="sticky top-0 z-20 -mx-6 mt-8 flex gap-2 overflow-x-auto bg-bg/80 px-6 py-3 backdrop-blur-xl no-scrollbar sm:-mx-10 sm:px-10" role="tablist" aria-label="Tool categories">
          {[{ id: 'all' as const, name: 'All' }, ...CATEGORIES].map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}
              className={`relative shrink-0 rounded-full border px-4 py-2 text-[14px] transition-colors ${cat === c.id ? 'border-transparent text-bg' : 'border-line text-muted hover:border-line-strong hover:text-fg'}`}>
              {cat === c.id && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full bg-fg" transition={{ type: 'spring', stiffness: 480, damping: 36 }} />}
              <span className="relative">{c.name}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      {groups.map((g) => (
        <div key={g.id} className="mt-10">
          <h3 className="border-b border-line pb-3 text-[14px] font-medium text-muted">{g.name}</h3>
          <div className="mt-3 grid gap-1 md:grid-cols-2 xl:grid-cols-3">
            {g.tools.map((tool, i) => <ToolRow key={tool.id} tool={tool} i={i} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function Dashboard({ onSearch }: { onSearch: () => void }) {
  return (
    <>
      <Hero onSearch={onSearch} />
      <Featured />
      <AllTools />
    </>
  );
}
