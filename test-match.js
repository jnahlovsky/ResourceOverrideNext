import { match, matchReplace } from './src/extension/match.js';

const url = "https://www-dc1.test.ifortuna.cz/fe/betslip-container/manifest.json";
const pattern = "/https:\\/\\/[^\\/]*(?:test|stage|localhost|ifortuna)/";
const replace = "https://localhost:8081";

const m = match(pattern, url);
console.log("Match Result:", m);
if (m.matched) {
    console.log("Replaced:", matchReplace(m, replace, url));
}
