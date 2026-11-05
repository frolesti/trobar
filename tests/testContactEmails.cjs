const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const contactEmails = require('../app/src/data/contactEmails.json');

const root = path.resolve(__dirname, '..');
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree?.props ? text(tree.props.children) : typeof tree === 'string' ? tree : '';

function load(segments, mocks = {}) {
  const filename = path.join(root, ...segments);
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.endsWith('/contactEmails.json')) return contactEmails;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return { useState: initial => [initial, () => {}] };
      if (name === 'next/head' || name === 'next/link') return { __esModule: true, default: name === 'next/link' ? 'a' : 'head' };
      if (name === '../components/Header' || name === '../components/Footer') return { __esModule: true, default: name };
      throw new Error(`Unexpected dependency ${name} in ${filename}`);
    },
  });
  return module.exports;
}

const legal = () => load(['app', 'src', 'data', 'legalContent.ts']);

test('only the three confirmed Workspace addresses are published by the shared directory', () => {
  assert.deepEqual(contactEmails, {
    general: 'hola@trobar.cat',
    support: 'suport@trobar.cat',
    billing: 'facturacio@trobar.cat',
  });
});

test('privacy and service help use support; billing and general enquiries use their own mailbox', () => {
  const { PRIVACY, TERMS } = legal();
  assert.equal(PRIVACY.contactEmail, contactEmails.support);
  assert.equal(TERMS.contactEmail, contactEmails.support);
  assert.equal(PRIVACY.lastUpdated, '5 de novembre de 2026');
  assert.equal(TERMS.lastUpdated, '5 de novembre de 2026');
  const privacy = JSON.stringify(PRIVACY);
  assert.ok(privacy.includes(contactEmails.support));
  assert.ok(!privacy.includes(contactEmails.general));
  assert.ok(!privacy.includes(contactEmails.billing));
  const payments = TERMS.sections.find(section => section.title === '7. Subscripcions i Pagaments');
  assert.ok(JSON.stringify(payments).includes(contactEmails.billing));
  const contact = TERMS.sections.find(section => section.title === '18. Contacte');
  assert.ok(JSON.stringify(contact).includes(contactEmails.support));
  assert.ok(JSON.stringify(contact).includes(contactEmails.general));
});

test('desktop and mobile footer labels and mailto destinations both use the general mailbox', () => {
  const Footer = load(['web-app', 'components', 'Footer.tsx']).default;
  const links = nodes(Footer()).filter(node => node.props.href?.startsWith('mailto:'));
  assert.equal(links.length, 2);
  for (const link of links) {
    assert.equal(link.props.href, `mailto:${contactEmails.general}`);
    assert.equal(text(link), contactEmails.general);
  }
});

test('the web contact directory labels and links each mailbox by its actual purpose', () => {
  const Contact = load(['web-app', 'pages', 'contacte.tsx']).default;
  const rendered = nodes(Contact());
  for (const [label, email] of [
    ['Consultes generals i col·laboracions', contactEmails.general],
    ['Suport, incidències i privacitat', contactEmails.support],
    ['Factures, cobraments i subscripcions', contactEmails.billing],
  ]) {
    const row = rendered.find(node => node.type === 'p' && text(node).includes(label));
    assert.ok(row, label);
    const link = nodes(row).find(node => node.type === 'a');
    assert.equal(link.props.href, `mailto:${email}`);
    assert.equal(text(link), email);
  }
  assert.equal(rendered.filter(node => node.props.href?.startsWith('mailto:')).length, 3);
});

test('web and mobile legal renderers expose matching working mailto links from the canonical documents', async () => {
  const docs = legal();
  const opened = [];
  const { LegalScreen } = load(['app', 'src', 'screens', 'Legal', 'LegalScreen.tsx'], {
    'react-native': {
      ScrollView: 'ScrollView', View: 'View', TouchableOpacity: 'TouchableOpacity',
      StyleSheet: { create: value => value }, Linking: { openURL: async url => opened.push(url) },
    },
    '../../components/AppText': { __esModule: true, default: 'Text' },
    '../../components/AppIcon': { __esModule: true, default: 'AppIcon' },
    '../../components/IconCredits': { __esModule: true, default: 'IconCredits' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../theme/editorialTheme': { EDITORIAL: {}, ED_TYPE: {} },
    '@react-navigation/native': { useNavigation: () => ({ goBack() {} }) },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    '../../utils/webScreenStyles': {},
    '../../data/legalContent': docs,
  });
  const LegalBody = load(['web-app', 'components', 'LegalBody.tsx']).default;
  for (const doc of [docs.PRIVACY, docs.TERMS]) {
    const webTree = LegalBody({ doc });
    const mobileTree = LegalScreen({ doc });
    const webLinks = nodes(webTree).filter(node => node.type === 'a');
    const mobileLinks = nodes(mobileTree).filter(node => node.type === 'Text' && node.props.onPress);
    const expected = [...JSON.stringify(doc.sections).matchAll(/[\w.+-]+@trobar\.cat/g)].map(match => `mailto:${match[0]}`);
    assert.deepEqual(webLinks.map(node => node.props.href), expected);
    assert.deepEqual(mobileLinks.map(node => `mailto:${text(node)}`), expected);
    opened.length = 0;
    for (const link of mobileLinks) await link.props.onPress();
    assert.deepEqual(opened, expected);
    for (const link of webLinks) assert.equal(link.props.href, `mailto:${text(link)}`);
    for (const section of doc.sections) {
      for (const block of section.blocks.filter(block => block.kind === 'p')) {
        assert.ok(text(webTree).includes(block.text), 'Web preserves sentence punctuation');
        assert.ok(text(mobileTree).includes(block.text), 'App preserves sentence punctuation');
      }
    }
  }
});

test('public app and web sources contain no old domain or unapproved troBar mailbox', () => {
  const allowed = new Set(Object.values(contactEmails));
  function check(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) check(filename);
      else if (/\.(tsx?|jsx?|json|html)$/.test(entry.name)) {
        const source = fs.readFileSync(filename, 'utf8');
        assert.ok(!source.includes('@trobar-app.cat'), filename);
        for (const [email] of source.matchAll(/[\w.+-]+@trobar\.cat/g)) {
          assert.ok(allowed.has(email), `${filename}: ${email}`);
        }
      }
    }
  }
  for (const segments of [
    ['app', 'src'], ['web-app', 'pages'], ['web-app', 'components'], ['web-app', 'lib'], ['public'],
  ]) check(path.join(root, ...segments));
});
