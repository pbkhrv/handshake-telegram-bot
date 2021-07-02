const {
  validateExtract,
  parsePositiveInt,
  parseBlockNum,
  TelegramMarkdown: tgmd
} = require('../src/utils');

test('validateExtract works with simple stuff', () => {
  const obj = {sss: 'asdf', nummm: 12, ign: 'qwe', obbb: {k: 'v'}};

  const vals = {
    s: [obj.sss, {type: 'string', match: 'asdf'}],
    n: [obj.nummm, {type: 'number'}],
    ign: [obj.ign],
    k: [obj.obbb?.k, {type: 'string'}]
  };

  const {s, n, ign, k} = validateExtract(vals);

  expect(s).toBe('asdf');
  expect(n).toBe(12);
  expect(ign).toBeTruthy();
  expect(k).toBe('v');
});

test('parses positive number', () => {
  let number = parsePositiveInt('  +10  ');
  expect(number).toBe(10);
  number = parsePositiveInt('  + 9  ');
  expect(number).toBe(9);
  number = parsePositiveInt('  - 9  ');
  expect(number).toBeFalsy();
  number = parsePositiveInt('blah+6=what');
  expect(number).toBeFalsy();
  number = parsePositiveInt('34353');
  expect(number).toBeFalsy();
  number = parsePositiveInt('not a number');
  expect(number).toBeFalsy();
});

test('parses block number', () => {
  let number = parseBlockNum('  #10  ');
  expect(number).toBe(10);
  number = parseBlockNum('  # 9  ');
  expect(number).toBe(9);
  number = parseBlockNum('  #nada  ');
  expect(number).toBeFalsy();
  number = parseBlockNum('  - 9  ');
  expect(number).toBeFalsy();
  number = parseBlockNum('blah+6=what');
  expect(number).toBeFalsy();
  number = parseBlockNum('34353');
  expect(number).toBeFalsy();
  number = parseBlockNum('not a number');
  expect(number).toBeFalsy();
});

test('telegram markdown escapes necessary characters', () => {
  const text = new tgmd('_*[]()~`>#+-=|{}.!').toString();
  expect(text).toBe('\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!');
});

test('telegram markdown flattens list of strings or instances', () => {
  const hello = new tgmd('hello');
  const text = new tgmd(hello, ' ', 'world').toString();
  expect(text).toBe('hello world');
});

test('telegram markdown makes links', () => {
  const link = tgmd.link('Handshake!!', 'https://handshake.org');
  const text = new tgmd('click here! ', link).toString();
  expect(text).toBe('click here\\! [Handshake\\!\\!](https://handshake.org)');
});

test('telegram markdown can append', () => {
  const md = new tgmd('hello');
  md.append(' ');
  md.append('world!');
  expect(md.toString()).toBe('hello world\\!');
});

test('telegram markdown formats numbers', () => {
  const text = new tgmd(4.56).toString();
  expect(text).toBe('4\\.56');
});

test('telegram markdown does bold', () => {
  const text = tgmd.bold('WHAT', '!').toString();
  expect(text).toBe('*WHAT\\!*');
});

test('telegram markdown bold can nest', () => {
  const link = tgmd.link('Handshake!!', 'https://handshake.org');
  const text = tgmd.bold('click here! ', link).toString();
  expect(text).toBe('*click here\\! [Handshake\\!\\!](https://handshake.org)*');
});

test('telegram markdown can start with empty chunks', () => {
  const md = new tgmd();
  md.append('hello');
  md.append(' ');
  md.append('world!');
  expect(md.toString()).toBe('hello world\\!');
});

test('telegram markdown can append array', () => {
  const md = new tgmd('hello');
  md.append(' ', 'world!');
  expect(md.toString()).toBe('hello world\\!');
});