import { motion } from 'motion/react';
import { ChevronLeft, Lock } from 'lucide-react';
import { Suspense } from 'react';
import { CATEGORIES, type Tool } from '../lib/registry';
import { navigate } from '../lib/router';
import { TOOL_UI } from '../tools';

export default function ToolPage({ tool }: { tool: Tool }) {
  const UI = TOOL_UI[tool.id];
  const Icon = tool.icon;
  return (
    <section className="mx-auto max-w-[1100px] px-6 pt-10 pb-24 sm:px-10">
      <button onClick={() => navigate('/')} className="group mb-8 flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />All tools
      </button>
      <div className="flex items-start gap-4">
        <motion.span layoutId={`icon-${tool.id}`} className="grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-surface">
          <Icon className="size-6 text-ink" strokeWidth={1.75} />
        </motion.span>
        <div>
          <p className="text-[13px] text-faint">{CATEGORIES.find((c) => c.id === tool.category)?.name}</p>
          <h1 className="text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-[-0.035em]">{tool.name}</h1>
          <p className="mt-1 max-w-[60ch] text-muted">{tool.desc}</p>
        </div>
      </div>
      <p className="mt-5 flex items-center gap-2 text-[12.5px] text-faint"><Lock className="size-3.5" />Processed on this device. Your file is never uploaded.</p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-line bg-surface" />}>
          {UI ? <UI /> : <p className="text-muted">This tool is on its way.</p>}
        </Suspense>
      </div>
    </section>
  );
}
