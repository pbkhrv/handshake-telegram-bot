const db = require('../db');
const {getLastProcessedBlockHeight, recordLastProcessedBlock} =
    require('../handshake');

/* Helpers */

async function reinitDb() {
  await db.init('sqlite::memory:', {isQuietReinit: true});
  await db.recreateAllTables();
}


/* Tests */

test('finds latest processed block', async () => {
  await reinitDb();
  await recordLastProcessedBlock(1, 'hash1');
  await recordLastProcessedBlock(2, 'hash2');
  const maxBlockHeight = await getLastProcessedBlockHeight();
  expect(maxBlockHeight).toBe(2);
});