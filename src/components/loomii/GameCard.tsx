import React from 'react';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface GameCardProps {
  title: string;
  description: string;
  icon: React.ReactElement;
  color: string;
  onClick: () => void;
}

export function GameCard({ title, description, icon, color, onClick }: GameCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5, borderColor: 'hsl(var(--primary))' }}
      onClick={onClick}
      className="p-8 bg-card border border-border rounded-2xl cursor-pointer transition-all group"
    >
      <div className={`w-16 h-16 ${color} rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
        {React.cloneElement(icon, { className: "text-white w-8 h-8" })}
      </div>
      <h3 className="text-xl font-bold mb-2 uppercase italic tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-6 flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
        Play Now <ChevronRight className="w-3 h-3" />
      </div>
    </motion.div>
  );
}
