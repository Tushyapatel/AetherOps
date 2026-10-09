const { ESLint } = require("eslint");

(async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["src/**/*.ts"]);

  results.forEach(result => {
    const errors = result.messages.filter(m => m.severity === 2);
    if (errors.length > 0) {
      console.log(result.filePath);
      console.log(errors);
    }
  });
})().catch(console.error);
