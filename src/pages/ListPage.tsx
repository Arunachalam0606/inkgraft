import { motion } from 'motion/react';
import { toolById, type Tool } from '../lib/registry';
import { ToolRow } from '../components/ToolRow';

export default function ListPage({ title, ids, empty }: { title: string; ids: string[]; empty: string }) {
  const tools = ids.map(toolById).filter(Boolean) as Tool[];
  return (
    <section className="px-6 pt-16 pb-24 sm:px-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-[-0.035em]">{title}</motion.h1>
      {tools.length === 0
        ? <p className="mt-4 max-w-[48ch] text-muted">{empty}</p>
        : <div className="mt-8 grid gap-1 md:grid-cols-2 xl:grid-cols-3">{tools.map((t, i) => <ToolRow key={t.id} tool={t} i={i} />)}</div>}
    </section>
  );
}
