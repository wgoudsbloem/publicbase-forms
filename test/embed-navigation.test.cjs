const test = require('node:test');
const assert = require('node:assert/strict');
require('../ui/public/embed-navigation.js');
const navigation = globalThis.PublicBaseEmbedNavigation;

test('directory emits a null formPath', () => {
    assert.deepEqual(
        navigation.buildNavigationMessage('/ca/on/twin_peaks'),
        {
            source: 'publicbase',
            type: 'publicbase:navigation',
            version: 1,
            municipality: 'ca/on/twin_peaks',
            formPath: null,
            pathname: '/ca/on/twin_peaks'
        }
    );
});

test('form emits its municipality-relative formPath', () => {
    const message = navigation.buildNavigationMessage(
        '/ca/on/twin_peaks/dog_licence_application/pet-001/1'
    );
    assert.equal(message.formPath, 'dog_licence_application/pet-001/1');
    assert.equal(message.municipality, 'ca/on/twin_peaks');
});

test('valid HTTPS and localhost development origins are accepted', () => {
    assert.equal(
        navigation.getValidParentOrigin('https://twin-peaks.publicbase.com'),
        'https://twin-peaks.publicbase.com'
    );
    assert.equal(navigation.getValidParentOrigin('http://localhost:3000'), 'http://localhost:3000');
});

test('invalid parent origins are rejected', () => {
    [
        '*',
        'http://twin-peaks.publicbase.com',
        'javascript:alert(1)',
        'https://twin-peaks.publicbase.com/path',
        'https://user@example.com'
    ].forEach(value => assert.equal(navigation.getValidParentOrigin(value), ''));
});

test('postMessage always uses the validated exact origin and never wildcard', () => {
    const calls = [];
    const posted = navigation.postNavigationMessage({
        targetWindow: { postMessage: (...args) => calls.push(args) },
        targetOrigin: 'https://twin-peaks.publicbase.com',
        pathname: '/ca/on/twin_peaks'
    });
    assert.equal(posted, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1], 'https://twin-peaks.publicbase.com');
    assert.notEqual(calls[0][1], '*');
});

test('non-embed pages do not post navigation messages', () => {
    const calls = [];
    const posted = navigation.postNavigationMessage({
        targetWindow: { postMessage: (...args) => calls.push(args) },
        targetOrigin: 'https://twin-peaks.publicbase.com',
        pathname: '/ca/on/twin_peaks',
        embedRequested: false,
        isFramed: true
    });
    assert.equal(posted, false);
    assert.equal(calls.length, 0);
});

test('parent-origin propagates while existing query parameters are preserved', () => {
    const href = navigation.buildPropagatedInternalHref({
        rawHref: '/ca/on/twin_peaks/dog_licence_application/pet-001/1?language=fr#start',
        pageUrl: 'https://forms.publicbase.com/ca/on/twin_peaks?embed=true',
        embedRequested: true,
        maxWidth: '100%',
        parentOrigin: 'https://twin-peaks.publicbase.com'
    });
    const parsed = new URL(href, 'https://forms.publicbase.com');
    assert.equal(parsed.searchParams.get('language'), 'fr');
    assert.equal(parsed.searchParams.get('embed'), 'true');
    assert.equal(parsed.searchParams.get('max-width'), '100%');
    assert.equal(parsed.searchParams.get('parent-origin'), 'https://twin-peaks.publicbase.com');
    assert.equal(parsed.hash, '#start');
});

test('invalid parent-origin is not propagated', () => {
    const href = navigation.buildPropagatedInternalHref({
        rawHref: '/ca/on/twin_peaks/dog_licence_application/pet-001/1?existing=yes',
        pageUrl: 'https://forms.publicbase.com/ca/on/twin_peaks',
        embedRequested: true,
        maxWidth: '',
        parentOrigin: '*'
    });
    const parsed = new URL(href, 'https://forms.publicbase.com');
    assert.equal(parsed.searchParams.get('existing'), 'yes');
    assert.equal(parsed.searchParams.has('parent-origin'), false);
});

test('traversal and malformed paths are rejected', () => {
    [
        '/ca/on/../secret',
        '/ca/on/%2e%2e/secret',
        '/ca/on/twin_peaks/bad%2Fsegment/pet-001/1',
        '/ca//twin_peaks',
        'ca/on/twin_peaks',
        '/ca/on'
    ].forEach(pathname => assert.equal(navigation.buildNavigationMessage(pathname), null));
});

test('returning to the repository sends formPath null', () => {
    const message = navigation.buildNavigationMessage('/ca/on/twin_peaks/');
    assert.equal(message.formPath, null);
});
