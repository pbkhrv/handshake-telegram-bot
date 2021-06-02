const {parseCommandMessage, nameStateDetailsMarkdown, TelegramBot} =
    require('../telegram');

const testMessage = {
  message_id: 36,
  from: {
    id: 123123123,
    is_bot: false,
    first_name: 'John',
    username: 'johnsmith',
    language_code: 'en'
  },
  chat: {
    id: 123123123,
    first_name: 'John',
    username: 'johnsmith',
    type: 'private'
  },
  date: 1621974379,
  text: '',
  entities: [{offset: 0, length: 6, type: 'bot_command'}]
};


test('Returns bot command and args from incoming message', () => {
  const message = {...testMessage};
  message.text = '/start session';

  const cmd = parseCommandMessage(message);
  expect(cmd.command).toBe('/start');
  expect(cmd.args).toBe('session');
});

test(
    'Returns bot command and no args from incoming message with no args',
    () => {
      const message = {...testMessage};
      message.text = '/start';

      const cmd = parseCommandMessage(message);
      expect(cmd.command).toBe('/start');
      expect(cmd.args).toBe('');
    });

test('Returns no command with no slash-command syntax', () => {
  const message = {...testMessage};
  message.text = 'hello there';
  message.entities = undefined;

  const cmd = parseCommandMessage(message);
  console.log(cmd);
  expect(cmd.command).toBe('no_command');
  expect(cmd.args).toBeFalsy();
  expect(cmd.text).toBe(message.text);
});

test('Uses current command if no previous one exists', () => {
  const bot = new TelegramBot('token', {});
  const chatId = 123;
  bot.incompleteCommands[chatId] = undefined;

  const newCmd = {command: '/boo', args: ''};

  expect(bot.buildCurrentCommand(chatId, newCmd)).toBe(newCmd);
});

test('Completes previous command if new one is no_command', () => {
  const bot = new TelegramBot('token', {});
  const chatId = 123;
  bot.incompleteCommands[chatId] = {command: '/boo', args: ''};
  const newCmd = {command: 'no_command', text: 'ya'};
  const currentCmd = bot.buildCurrentCommand(chatId, newCmd);

  expect(currentCmd.command).toBe('/boo');
  expect(currentCmd.args).toBe('ya');
});

test('Replaces previous command with new one', () => {
  const bot = new TelegramBot('token', {});
  const chatId = 123;
  bot.incompleteCommands[chatId] = {command: '/boo', args: ''};
  const newCmd = {command: '/yada', args: 'yada'};

  expect(bot.buildCurrentCommand(chatId, newCmd)).toBe(newCmd);
});