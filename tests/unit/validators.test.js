const { isValidPayload } = require('../../src/utils/validators');

describe('Validators', () => {
  it('should validate correct payloads', () => {
    const payload = { name: 'test', value: 'data' };
    const result = isValidPayload(payload, ['name', 'value']);
    expect(result).toBe(true);
  });

  it('should reject payloads with missing required fields', () => {
    const payload = { name: 'test' };
    const result = isValidPayload(payload, ['name', 'value']);
    expect(result).toBe(false);
  });

  it('should reject payloads with extra fields', () => {
    const payload = { name: 'test', value: 'data', extra: 'field' };
    const result = isValidPayload(payload, ['name', 'value']);
    expect(result).toBe(false);
  });

  it('should handle empty payloads', () => {
    const payload = {};
    const result = isValidPayload(payload, ['name', 'value']);
    expect(result).toBe(false);
  });

  it('should validate payloads with multiple required fields', () => {
    const payload = { a: 1, b: 2, c: 3 };
    const result = isValidPayload(payload, ['a', 'b', 'c']);
    expect(result).toBe(true);
  });
});
