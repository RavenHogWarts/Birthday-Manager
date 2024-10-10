exports.default = {
  entry: getDaysUntilNextBirthday,
  scopes: ['formula'],
  description: `
  计算距离下个生日还有多少天。
  `
}

async function getDaysUntilNextBirthday() {
  const file = this.currentFile;
  const metadata = app.metadataCache.getFileCache(file);
  const frontmatter = metadata?.frontmatter;

  const birthdaySolar = frontmatter?.["birthdaySolar"];
  const nextBirthday = frontmatter?.["nextBirthday"];

  if (!birthdaySolar || !nextBirthday) {
    return "生日信息不完整";
  }

  const birthdayDate = new Date(birthdaySolar);
  const nextBirthdayDate = new Date(nextBirthday);
  const now = new Date();

  const timeDiff = nextBirthdayDate - now;
  const daysUntilNextBirthday = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  const nextAge = nextBirthdayDate.getFullYear() - birthdayDate.getFullYear();

  return `${nextAge}岁生日还有${daysUntilNextBirthday}天`;
}
