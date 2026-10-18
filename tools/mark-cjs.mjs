import fs from "node:fs"; fs.mkdirSync(".build-test",{recursive:true}); fs.writeFileSync(".build-test/package.json", JSON.stringify({type:"commonjs"}));
