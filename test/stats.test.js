const db = require('../src/db');
const stats = require('../src/stats');

async function reinitDb() {
  await db.init('sqlite::memory:', {isQuietReinit: true});
  await db.recreateAllTables();
};

test('counts commands correctly', async () => {
  await reinitDb();
  await stats.logReceivedCommand(1, 'cmd1');
  await stats.logReceivedCommand(2, 'cmd1');
  await stats.logReceivedCommand(1, 'cmd2');
  const counts = await stats.commandCounts();
  const cmd1s = counts.find(c => c.command == 'cmd1');
  const cmd2s = counts.find(c => c.command == 'cmd2');
  expect(cmd1s.count).toBe(2);
  expect(cmd2s.count).toBe(1);
});

test('counts chats correctly', async () => {
  await reinitDb();
  await stats.logReceivedCommand(1, 'cmd1');
  await stats.logReceivedCommand(2, 'cmd1');
  await stats.logReceivedCommand(1, 'cmd2');
  const chats = await stats.uniqueChats();
  expect(chats).toBe(2);
})