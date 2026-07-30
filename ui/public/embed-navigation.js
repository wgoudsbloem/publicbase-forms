(function initPublicBaseEmbedNavigation(globalScope, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (globalScope) {
        globalScope.PublicBaseEmbedNavigation = api;
    }
}(typeof window !== 'undefined' ? window : globalThis, function createPublicBaseEmbedNavigation() {
    'use strict';

    const NAVIGATION_MESSAGE_TYPE = 'publicbase:navigation';
    const NAVIGATION_MESSAGE_VERSION = 1;
    const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

    function getValidParentOrigin(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        let parsed;
        try {
            parsed = new URL(raw);
        } catch {
            return '';
        }
        const isLocalhost = parsed.hostname === 'localhost'
            || parsed.hostname === '127.0.0.1'
            || parsed.hostname === '[::1]';
        if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) return '';
        if (parsed.username || parsed.password || parsed.search || parsed.hash) return '';
        if (parsed.pathname !== '/' && parsed.pathname !== '') return '';
        return parsed.origin;
    }

    function decodeSafePathSegment(rawSegment) {
        let decoded;
        try {
            decoded = decodeURIComponent(rawSegment);
        } catch {
            return '';
        }
        if (!decoded || decoded === '.' || decoded === '..') return '';
        return SAFE_PATH_SEGMENT_PATTERN.test(decoded) ? decoded : '';
    }

    function getNavigationPathDetails(pathname) {
        const rawPath = String(pathname || '').trim();
        if (!rawPath.startsWith('/') || rawPath.includes('?') || rawPath.includes('#') || rawPath.includes('//')) {
            return null;
        }
        const normalizedPath = rawPath.replace(/\/index\.html$/, '').replace(/\/+$/, '');
        const rawSegments = normalizedPath.split('/').slice(1);
        if (rawSegments.length < 3) return null;
        const segments = rawSegments.map(decodeSafePathSegment);
        if (segments.some(segment => !segment)) return null;
        const municipalitySegments = segments.slice(0, 3);
        const formSegments = segments.slice(3);
        return {
            municipality: municipalitySegments.join('/'),
            formPath: formSegments.length ? formSegments.join('/') : null,
            pathname: `/${segments.join('/')}`
        };
    }

    function buildNavigationMessage(pathname) {
        const details = getNavigationPathDetails(pathname);
        if (!details) return null;
        return {
            source: 'publicbase',
            type: NAVIGATION_MESSAGE_TYPE,
            version: NAVIGATION_MESSAGE_VERSION,
            municipality: details.municipality,
            formPath: details.formPath,
            pathname: details.pathname
        };
    }

    function shouldSynchronize({ embedRequested, targetOrigin, isFramed }) {
        return embedRequested === true && isFramed === true && Boolean(getValidParentOrigin(targetOrigin));
    }

    function postNavigationMessage({ targetWindow, targetOrigin, pathname, embedRequested = true, isFramed = true }) {
        const validTargetOrigin = getValidParentOrigin(targetOrigin);
        const message = buildNavigationMessage(pathname);
        if (!targetWindow || !message || !shouldSynchronize({
            embedRequested,
            targetOrigin: validTargetOrigin,
            isFramed
        })) return false;
        targetWindow.postMessage(message, validTargetOrigin);
        return true;
    }

    function buildPropagatedInternalHref({
        rawHref,
        pageUrl,
        embedRequested,
        maxWidth,
        parentOrigin
    }) {
        const href = String(rawHref || '').trim();
        if (!href || href.startsWith('#')) return '';
        let resolved;
        let current;
        try {
            current = new URL(pageUrl);
            resolved = new URL(href, current);
        } catch {
            return '';
        }
        if (resolved.origin !== current.origin) return '';
        if (maxWidth && !resolved.searchParams.has('max-width')) {
            resolved.searchParams.set('max-width', maxWidth);
        }
        if (embedRequested) {
            resolved.searchParams.set('embed', 'true');
            const validParentOrigin = getValidParentOrigin(parentOrigin);
            if (validParentOrigin) {
                resolved.searchParams.set('parent-origin', validParentOrigin);
            }
        }
        return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }

    return {
        NAVIGATION_MESSAGE_TYPE,
        NAVIGATION_MESSAGE_VERSION,
        getValidParentOrigin,
        getNavigationPathDetails,
        buildNavigationMessage,
        shouldSynchronize,
        buildPropagatedInternalHref,
        postNavigationMessage
    };
}));
