const {validateExtract, parsePositiveInt, parseBlockNum} = require('../utils');

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
})