import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import type { Tool } from '../lib/registry';
import { starred, toggleStar } from '../lib/prefs';
import { openTool } from './CommandPalette';

export function ToolRow({ tool, i = 0 }: { tool: Tool; i?: number }) {
  const stars = starred.use();
  const on = stars.includes(tool.id);
  const Icon = tool.icon;
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex gap-4 rounded-2xl p-4 transition-colors ${tool.ready ? 'cursor-pointer hover:bg-surface' : 'opacity-55'}`}
      title={tool.desc}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface transition-transform duration-300 ease-out-expo group-hover:-translate-y-0.5 group-hover:border-line-strong">
        <Icon className="size-[19px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 pr-6">
        {/* stretched button: the whole row is one keyboard target */}
        <button
          onClick={() => openTool(tool)} disabled={!tool.ready}
          className="flex items-center gap-2 text-left text-[15px] font-medium tracking-tight text-fg after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent"
        >
          {tool.name}
          {!tool.ready && <span className="rounded-full border border-line px-1.5 text-[10px] font-normal text-faint">Soon</span>}
        </button>
        <span className="mt-1 line-clamp-2 block text-[13.5px] leading-snug text-muted">{tool.desc}</span>
      </span>
      {tool.ready && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleStar(tool.id); }} aria-label={on ? `Unstar ${tool.name}` : `Star ${tool.name}`} aria-pressed={on}
          className={`absolute top-4 right-4 z-10 rounded-md p-1 transition-all ${on ? 'text-amber-400 opacity-100' : 'text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-fg'}`}
        >
          <motion.span key={String(on)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 15 }} className="block">
            <Star className="size-4" fill={on ? 'currentColor' : 'none'} />
          </motion.span>
        </button>
      )}
    </motion.div>
  );
}
