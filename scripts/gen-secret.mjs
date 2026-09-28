// .env.local 이 없으면 .env.example 을 복사해 만들고,
// APP_SECRET 이 비어 있으면 무작위 값을 채운다. (값은 화면에 출력하지 않음)
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const path = ".env.local";
if (!existsSync(path)) {
  copyFileSync(".env.example", path);
  console.log(".env.local 파일을 만들었습니다.");
}

const text = readFileSync(path, "utf8");
if (/^APP_SECRET=\S+/m.test(text)) {
  console.log("APP_SECRET 이 이미 있습니다. 변경하지 않았습니다.");
} else {
  const secret = randomBytes(32).toString("base64url");
  const next = /^APP_SECRET=.*$/m.test(text)
    ? text.replace(/^APP_SECRET=.*$/m, `APP_SECRET=${secret}`)
    : `${text.trimEnd()}\nAPP_SECRET=${secret}\n`;
  writeFileSync(path, next);
  console.log("APP_SECRET 을 자동 생성해 .env.local 에 저장했습니다.");
}
