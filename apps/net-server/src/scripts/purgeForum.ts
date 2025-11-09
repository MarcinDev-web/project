/**
 * Purge all forum threads and posts.
 * - If DATABASE_URL is set → uses Prisma and cascades delete via relations
 * - Otherwise → uses JSON storage and deletes each thread (which removes its posts)
 */

import path from 'path';
import { getPrismaClient, disconnectPrisma } from '../lib/db.js';
import { ForumStorage } from '../storage/ForumStorage.js';

async function purgeWithDatabase(): Promise<void> {
	const prisma = await getPrismaClient();
	try {
		// Single operation: deleting threads cascades to posts, reactions, votes
		const { count } = await prisma.forumThread.deleteMany({});
		console.log(`Deleted ${count} forum threads (posts/reactions/votes cascaded).`);
	} finally {
		await disconnectPrisma();
	}
}

async function purgeWithJson(): Promise<void> {
	const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
	const storage = new ForumStorage(dataDir);
	await storage.initialize();

	const { threads } = await storage.getAllThreads();
	if (threads.length === 0) {
		console.log('No threads found in JSON storage. Nothing to delete.');
		return;
	}

	let deleted = 0;
	for (const thread of threads) {
		// force=true to bypass author checks
		const ok = await storage.deleteThread(thread.id, 'admin', true);
		if (ok) {
			deleted++;
		}
	}
	console.log(`Deleted ${deleted} forum threads from JSON storage (including all posts).`);
}

async function main(): Promise<void> {
	const hasDb = Boolean(process.env.DATABASE_URL);
	console.log(`Purge forum starting (backend=${hasDb ? 'database' : 'json'}).`);
	if (hasDb) {
		await purgeWithDatabase();
	} else {
		await purgeWithJson();
	}
	console.log('Purge forum completed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
	void main()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error('Purge forum failed:', err);
			process.exit(1);
		});
}


