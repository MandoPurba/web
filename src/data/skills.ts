export interface SkillGroup {
  category: string;
  items: string[];
}

export const skills: SkillGroup[] = [
  { category: 'Languages', items: ['Go', 'TypeScript', 'SQL', 'Rust', 'PHP'] },
  { category: 'Backend', items: ['NestJS', 'Actix Web', 'REST', 'Laravel'] },
  { category: 'Async & jobs', items: ['Job queues', 'Leases', 'Retry + backoff', 'LISTEN/NOTIFY'] },
  { category: 'Databases', items: ['PostgreSQL', 'Redis', 'SKIP LOCKED'] },
  { category: 'DevOps', items: ['Docker', 'Linux', 'CI/CD'] },
];
