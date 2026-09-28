import os from "node:os";

/** 같은 와이파이의 다른 기기(휴대폰)가 접속할 수 있는 이 컴퓨터의 IP. 못 찾으면 null. */
export function getLanIp(): string | null {
  const ifaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const list of Object.values(ifaces)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) candidates.push(iface.address);
    }
  }
  // 192.168.x.x 같은 사설 IP(집/사무실 공유기 대역)를 우선한다.
  const priv = candidates.find((ip) => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip));
  return priv ?? candidates[0] ?? null;
}
