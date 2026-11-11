/* ===== share.js - 다른 기기로 보물찾기 보내기 =====
 * 서버가 없으므로 저장한 설정(config)을 통째로 주소(join.html#c=…)에 담는다.
 * 암호가 아니다. 아이가 주소만 보고 보물 상자 암호를 읽지 못하게 가볍게 가리는 정도다.
 * 미니게임의 개별 설정(사진, 녹음 등)은 담기지 않는다. 받는 기기에서는 미니게임이 기본 설정으로 돈다.
 */
var HuntShare = (function () {
    'use strict';
    var MASK = [0x27, 0x5e, 0x13, 0x6a, 0x41, 0x0c, 0x72, 0x39];

    function toBase64Url(bytes) {
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function fromBase64Url(text) {
        var bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function encode(config) {
        var bytes = new TextEncoder().encode(JSON.stringify(config));
        for (var i = 0; i < bytes.length; i++) bytes[i] ^= MASK[i % MASK.length];
        return toBase64Url(bytes);
    }

    /** 읽을 수 없거나 보물찾기 설정이 아니면 null */
    function decode(text) {
        try {
            var bytes = fromBase64Url(text);
            for (var i = 0; i < bytes.length; i++) bytes[i] ^= MASK[i % MASK.length];
            var config = JSON.parse(new TextDecoder().decode(bytes));
            if (!config || !Array.isArray(config.missions) || !config.missions.length) return null;
            return config;
        } catch (e) {
            return null;
        }
    }

    /** 아이 기기에서 열 주소. base 는 treasure-hunt3 폴더 안의 아무 주소 */
    function url(config, base) {
        return new URL('join.html', base || location.href).href + '#c=' + encode(config);
    }

    return { encode: encode, decode: decode, url: url };
})();
