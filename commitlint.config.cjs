const chineseDescription = (parsed) => {
 const subject = parsed.subject ?? '';
 return [/[\u3400-\u9fff]/u.test(subject), 'subject must contain Simplified Chinese'];
};

module.exports = {
 extends: ['@commitlint/config-conventional'],
 plugins: [{ rules: { 'subject-has-chinese': chineseDescription } }],
 rules: {
 'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'test', 'refactor', 'perf', 'build', 'ci', 'chore', 'revert']],
 'scope-case': [2, 'always', 'kebab-case'],
 'header-max-length': [2, 'always', 100],
 'subject-empty': [2, 'never'],
 'subject-full-stop': [2, 'never', '.'],
 'subject-has-chinese': [2, 'always'],
 },
};
