import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Football } from "@/components/Football";

const svg = renderToStaticMarkup(createElement(Football, { design: "molten", className: "" }));
const out = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="-50 -50 100 100">${svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</svg>`;
await Bun.write("/tmp/browser/molten.svg", out);
console.log("bytes", out.length);
