import { neon } from '@neondatabase/serverless';
import Q from './queries.json';
export function database(env){ if(!env.DATABASE_URL) throw new Error('Database is not configured.'); return neon(env.DATABASE_URL); }
export async function countProjects(env){ return database(env).query(Q.countProjects); }
