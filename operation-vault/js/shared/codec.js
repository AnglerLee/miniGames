// 작전 코드용 인코딩: 크록포드 Base32 와 CRC-8.
// 크록포드 방식은 헷갈리는 글자(I, L, O, U)를 쓰지 않아 손으로 옮겨 적기 좋다.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 바이트 배열을 Base32 문자열로 바꾼다. */
export function encodeBase32(bytes) {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

/** 사람이 입력한 글자를 정리한다: 소문자, 띄어쓰기, 줄표, 헷갈리는 글자를 받아 준다. */
export function cleanBase32(text) {
  return String(text)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** Base32 문자열을 바이트 배열로 되돌린다. 잘못된 글자가 있으면 null. */
export function decodeBase32(text, byteLength) {
  const clean = cleanBase32(text);
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
    buffer &= (1 << bits) - 1;
  }
  if (out.length < byteLength) return null;
  return out.slice(0, byteLength);
}

/** CRC-8 (다항식 0x07). 코드를 잘못 입력했을 때 걸러 낸다. */
export function crc8(bytes) {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}
