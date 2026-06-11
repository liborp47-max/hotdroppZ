import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HdCentralPage from '../app/(dashboard)/hd-central/page.tsx';

test('main page smoke renders without throwing', () => {
  const markup = renderToStaticMarkup(React.createElement(HdCentralPage));

  assert.ok(markup.length > 0);
  assert.match(markup, /Loading|Audit Summary|HD Central/);
});
