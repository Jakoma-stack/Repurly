import assert from 'node:assert/strict';
import test from 'node:test';
import { readOpenAiResponseText } from '../../src/lib/ai/response-text';

test('parses raw Responses API output instead of SDK-only output_text field', () => {
  const raw = { output: [
    { type: 'reasoning', summary: [] },
    { type: 'message', content: [{ type: 'output_text', text: '{"actions":[]}' }] },
  ] };
  assert.equal(readOpenAiResponseText(raw), '{"actions":[]}');
});

test('supports convenience output_text and rejects incomplete/error payloads', () => {
  assert.equal(readOpenAiResponseText({ output_text: '  hello  ' }), 'hello');
  assert.equal(readOpenAiResponseText({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }), null);
  assert.equal(readOpenAiResponseText(null), null);
});
