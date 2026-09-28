// 서버를 켤 때마다 노트북/휴대폰에서 각각 어떤 주소로 들어가면 되는지 먼저 알려준다.
import os from "node:os";

function getLanIp() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const list of Object.values(ifaces)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) candidates.push(iface.address);
    }
  }
  const priv = candidates.find((ip) => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip));
  return priv ?? candidates[0] ?? null;
}

const port = process.env.PORT || 3000;
const ip = getLanIp();

console.log("");
console.log("=================================================");
console.log(" 강원크루 데모 서버를 준비하고 있어요");
console.log("=================================================");
console.log(` 노트북 관리자 화면 : http://localhost:${port}/admin`);
console.log(` 노트북 QR 화면     : http://localhost:${port}/admin/qr`);
if (ip) {
  console.log(` 휴대폰 접속 IP     : ${ip}  (QR 화면에서 자동으로 QR과 글자 주소로 보여줘요)`);
} else {
  console.log(" 휴대폰 접속 IP를 찾지 못했어요. 와이파이 연결을 확인해주세요.");
}
console.log(" 휴대폰은 반드시 노트북과 같은 와이파이에 연결되어 있어야 해요.");
console.log(" 처음 실행 시 Windows 방화벽 허용 창이 뜨면 '액세스 허용'을 눌러주세요.");
console.log("=================================================");
console.log("");
