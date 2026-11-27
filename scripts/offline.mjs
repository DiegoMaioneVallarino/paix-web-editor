import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL("../dist/", import.meta.url);
const read = (path) => readFileSync(new URL(path, dir), "utf8");
const html = read("index.html")
  .replace(
    /<script [^>]*src="([^"]+)"[^>]*><\/script>/,
    (_, path) =>
      '<script type="module">' +
      read(path).replace(/<\/script/gi, "<\\/script") +
      "</script>",
  )
  .replace(
    /<link [^>]*href="([^"]+\.css)"[^>]*>/,
    (_, path) => "<style>" + read(path) + "</style>",
  );
writeFileSync(new URL("../Pairtial.html", import.meta.url), html);
