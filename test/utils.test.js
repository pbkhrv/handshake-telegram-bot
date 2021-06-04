const {validateExtract} = require('../utils');

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