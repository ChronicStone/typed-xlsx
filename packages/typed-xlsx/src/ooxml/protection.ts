export function hashExcelProtectionPassword(password: string) {
  if (!password) {
    return undefined;
  }

  let hash = 0;

  for (let index = password.length - 1; index >= 0; index -= 1) {
    const code = password.charCodeAt(index);
    hash = rotateLeft15(hash);
    hash ^= code;
  }

  hash = rotateLeft15(hash);
  hash ^= password.length;
  hash ^= 0xce4b;

  return hash.toString(16).toUpperCase().padStart(4, "0");
}

function rotateLeft15(value: number) {
  const highBit = (value >> 14) & 0x0001;
  return ((value << 1) & 0x7fff) | highBit;
}
