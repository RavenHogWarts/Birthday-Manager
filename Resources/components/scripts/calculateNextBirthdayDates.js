exports.default = {
  entry: calculateNextBirthdayDates,
  scopes: ['formula'],
  description: `
  根据公历生日或农历生日，计算下一个生日日期。
  # 文档属性
  你的文档需要包含以下属性：
  - \`birthdaySolar\`: 公历生日，必填属性，格式为 "YYYY-MM-DD", 
  - \`birthdayLunar\`: 农历生日，可填属性，格式为 "YYYY年MM月DD日 (农历)"，如2024年腊月廿一, 没有会根据公历生日自动生成
  - \`birthdayType\`: 生日类型，可填属性，有 "Lunar" 和 "Solar" 两种，没有设置程序默认为 "Solar"
  # 映射表
  - \`农历月映射表\`：['正','二','三','四','五','六','七','八','九','十','冬','腊']
  - \`农历日映射表\`：['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  `
}

async function calculateNextBirthdayDates() {
  const file = this.currentFile;
  const metadata = app.metadataCache.getFileCache(file);
  const frontmatter = metadata?.frontmatter;

  const birthdaySolar = frontmatter?.["birthdaySolar"];
  let birthdayLunar = frontmatter?.["birthdayLunar"];
  const birthdayType = frontmatter?.["birthdayType"];

  let nextBirthday;

  if(birthdaySolar){
    // 从公历生日转换并更新农历生日
    const [solarYear, solarMonth, solarDay] = birthdaySolar.split("-").map(Number);
    const timestamp = getTimestampBySolar(solarYear, solarMonth, solarDay);
    const lunarBirthday = getLunarByTimestamp(timestamp);

    // 生成农历中文格式，处理闰月情况
    const lunarMonthText = lunarBirthday.isLeap ? `闰${monthMap[lunarBirthday.lMonth - 1]}` : monthMap[lunarBirthday.lMonth - 1];
    const lunarBirthdayString = `${lunarBirthday.lYear}年${lunarMonthText}月${dayMap[lunarBirthday.lDay - 1]}`;

    // 更新农历生日到 frontmatter
    updateFrontMatter(file, (frontmatter) => {
      frontmatter["birthdayLunar"] = lunarBirthdayString;
    });
    birthdayLunar = lunarBirthdayString; // 赋值以继续后续逻辑
  }else if(!birthdaySolar && birthdayLunar){
    const [lunarYear, lunarMonthText, lunarDayText] = birthdayLunar.match(/(\d{4})年(闰?[^月]+)月(.+)/).slice(1);
    const isLeap = lunarMonthText.startsWith("闰");
    const lunarMonth = monthMap.indexOf(lunarMonthText.replace("闰", "")) + 1;
    const lunarDay = dayMap.indexOf(lunarDayText) + 1;

    const timestamp = getTimestampByLunar(lunarYear, lunarMonth, lunarDay, isLeap);
    const solarBirthday = getSolarByTimestamp(timestamp);

    const solarBirthdayString = `${solarBirthday.sYear}-${String(solarBirthday.sMonth).padStart(2, "0")}-${String(solarBirthday.sDay).padStart(2, "0")}`;

    updateFrontMatter(file, (frontmatter) => {
      frontmatter["birthdaySolar"] = solarBirthdayString;
    });
    birthdaySolar = solarBirthdayString;
  }

  switch (birthdayType) {
    case "Lunar":
      // 解析已存在的农历生日，转换为标准日期格式
      const [lunarYear, lunarMonthText, lunarDayText] = birthdayLunar.match(/(\d{4})年(闰?[^月]+)月(.+)/).slice(1);
      const isLeap = lunarMonthText.startsWith("闰");
      const lunarMonth = monthMap.indexOf(lunarMonthText.replace("闰", "")) + 1;
      const lunarDay = dayMap.indexOf(lunarDayText) + 1;

      const currentTimestamp = Date.now();
      const currentLunar = getLunarByTimestamp(currentTimestamp);

      let nextLunarYear = currentLunar.lYear;

      if (
        lunarMonth < currentLunar.lMonth ||
        (lunarMonth === currentLunar.lMonth && lunarDay <= currentLunar.lDay)
      ) {
        nextLunarYear += 1;
      }

      const nextLunarTimestamp = getTimestampByLunar(
        nextLunarYear,
        lunarMonth,
        lunarDay,
        false // 农历生日的计算不处理闰月
      );

      nextBirthday = getSolarByTimestamp(nextLunarTimestamp);
      // nextBirthday.date = `${nextBirthday.date} (农历)`;
      // 检查农历月是否有三十日，如果没有，则调整到廿九
      const lunarMonthDays = getLunarMonthDays(nextLunarYear, lunarMonth, getLeapMonth(nextLunarYear));
      if (lunarDay > lunarMonthDays) {
        nextBirthday.sDay -= 1;
      }
      break;
    case "Solar":
    default:
      const [solarYear, solarMonth, solarDay] = birthdaySolar.split("-").map(Number);
      const now = new Date();
      const currentYear = now.getFullYear();

      let nextYear = currentYear;
      if (now.getMonth() + 1 > solarMonth || (now.getMonth() + 1 === solarMonth && now.getDate() > solarDay)) {
        nextYear += 1;
      }

      nextBirthday = {
        sYear: nextYear,
        sMonth: solarMonth,
        sDay: solarDay,
      };
      break;
  }

  const formatNextBirthday = getDateString(nextBirthday.sYear, nextBirthday.sMonth, nextBirthday.sDay);

  const birthdayLunarYear = parseInt(birthdayLunar.match(/(\d{4})年/)[1], 10);;
  const birthdaySolarMonth = new Date(birthdaySolar).getMonth() + 1;
  const birthdaySolarDay = new Date(birthdaySolar).getDate();

  const ganzhi = getGanZhiYear(birthdayLunarYear);
  const animal = getAnimalYear(birthdayLunarYear);
  const zodiac = getZodiac(birthdaySolarMonth, birthdaySolarDay);

  const birthdayDate = new Date(birthdaySolar);
  const nextBirthdayDate = new Date(formatNextBirthday);
  const daysUntilNextBirthday = Math.ceil((nextBirthdayDate - new Date()) / (1000 * 60 * 60 * 24));
  const nextAge = nextBirthdayDate.getFullYear() - birthdayDate.getFullYear();

  updateFrontMatter(file, (frontmatter) => {
    frontmatter["nextBirthday"] = formatNextBirthday;
    frontmatter["animal"] = `${ganzhi}年 ${animal}`;
    frontmatter["zodiac"] = zodiac;
  });
  return `${nextAge}岁生日还有${daysUntilNextBirthday}天`;
}

function updateFrontMatter(file, updateFrontmatterFunc) {
  app.fileManager.processFrontMatter(file, (frontmatter) => {
    updateFrontmatterFunc(frontmatter);
  });
}

/*
This file is part of mumuy/calendar.

mumuy/calendar is licensed under the MIT License. See the LICENSE file (https://github.com/mumuy/calendar/blob/main/LICENSE) for more details.

Portions of this code are based on work from the mumuy/calendar project by mumuy (Copyright 2022).
The original project is licensed under the MIT License. See https://github.com/mumuy/calendar for more details.
*/
function getDateString(...param){
  return param.map(function(value){
      return (''+value).padStart(2,'0');
  }).join('-');
}

// 星期
const weekMap = ['日','一','二','三','四','五','六'];
// 公历日期转时间戳
function getTimestampBySolar(sYear,sMonth,sDay){
  return Date.UTC(sYear, sMonth-1, sDay, 0, 0, 0);
};
// 通过时间戳获取日期
function getSolarByTimestamp(timestamp){
  let now = new Date(timestamp);
  let week = now.getDay();
  let item = {
      sYear:now.getFullYear(),
      sMonth:now.getMonth()+1,
      sDay:now.getDate(),
      week:week,
      weekZH:'星期'+weekMap[week]
  };
  item['date'] = getDateString(item['sYear'],item['sMonth'],item['sDay']);
  return item;
}
// 获取公历一个月天数
function getSolarMonthDays(sYear,sMonth){
  let day = new Date(sYear,sMonth,0);
  return  day.getDate();
}

// lunar.js, https://github.com/mumuy/calendar/blob/main/src/module/lunar.js
// 农历有效期范围
const minYear = 1900;
const minMonth = 1;
const minDay = 30;
const maxYear = 2100;
// 闰月数据压缩：1位闰月大小+12位平月大小及4位长度闰月月份转2进制，再转32进制
const monthData = [
  'iuo','in0','19bg','l6l','1kj0','1mag','2pak','ll0','16mg','lei',
  'in0','19dm','196g','1kig','3kil','1da0','1ll0','1bd2','15dg','2ibn',
  'ibg','195g','1d5l','qig','ra0','3aqk','ar0','15bg','kni','ibg',
  'pb6','1l50','1qig','rkl','mmg','ar0','31n3','14n0','3i6n','1iag',
  '1l50','3m56','1dag','ll0','39dk','9eg','14mg','1kli','1aag','1dan',
  'r50','1dag','2kql','jd0','19dg','2hbj','klg','1ad8','1qag','ql0',
  '1bl6','1aqg','ir0','1an4','19bg','kj0','1sj3','1mag','mqn','ll0',
  '15mg','jel','img','196g','1l6k','1kig','1lao','1da0','1dl0','35d6',
  '15dg','idg','1abk','195g','1cjq','qig','ra0','1bq6','1ar0','15bg',
  'inl','ibg','p5g','t53','1qig','qqo','le0','1ar0','15ml','14n0',
  '1ib0','1mak','1l50','1mig','tai','ll0','1atn','9eg','14mg','1ill',
  '1aag','1d50','1el4','1bag','lep','it0','19dg','2kbm','klg','1a9g',
  'uak','ql0','1bag','mqi','ir0','19n6','1970','1kj0','1qj5','1l9g',
  'ml0','tl3','15mg','inr','img','196g','3k5m','1kig','1l90','1na5',
  '1dd0','lmg','ldi','idg','19bn','195g','1aig','3cil','r90','1bd0',
  '2ir3','14rg','ifo','ibg','p5g','2q56','1qig','qp0','39m4','1an0',
  '18n0','1kn3','1ib0','1lan','1l50','1mig','nal','ll0','19mg','lek',
  'kmg','1ado','1aag','1d50','1dl6','1bag','ld0','1at4','19dg','klg',
  '1cjj','q9g','spn','ql0','1bag','2iql','ir0','19bg','l74','1kb0',
  '1qb8','1l90','1ml0','2ql6','lmg','in0','1aek','18mg','1kag','1sii',
  '1l90'
];
// 月份
const monthMap = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
// 十位
const dayMap = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
// 参考时间点
const startTime = Date.UTC(minYear, minMonth-1, minDay, 0, 0, 0);
// 获取农历年闰月
function getLeapMonth(lYear){
  let data =  parseInt(monthData[lYear - minYear],32);
  return data&0xf;
}
// 获取农历年长度
function getLunarYearDays(lYear) {
  let offset = 0;
  let data = parseInt(monthData[lYear - minYear],32);
  for (let i = 1<<15; i >= 1<<4; i >>= 1) {
      offset += (data&i)?30:29;
  }
  if(getLeapMonth(lYear)){
      offset += (data&1<<16)?30:29;
  }
  return offset;
}
// 获得农历月份天数
function getLunarMonthDays(lYear,lMonth,isLeap){
  let leapMonth = getLeapMonth(lYear);
  let data = parseInt(monthData[lYear - minYear],32);
  let days = data&1<<(16 - lMonth)?30:29;
  if(isLeap&&lMonth==leapMonth){
      days = data&1<<16?30:29;
  }
  return days;
}
// 农历日期转时间戳
function getTimestampByLunar(lYear,lMonth,lDay,isLeap){
  // 有效性验证
  if(lYear<minYear||lYear>maxYear){
      return null;
  }
  if(lMonth<1||lMonth>12){
      return null;
  }
  let leapMonth = getLeapMonth(lYear);
  if(isLeap&&leapMonth!=lMonth){
      return null;
  }
  let days = (isLeap?data&1<<16:1<<(17-lMonth))?30:29;
  if(lDay>days){
      return null;
  }
  // 时间戳获取
  let offset = 0;
  let data = parseInt(monthData[lYear - minYear],32);
  for(let year=minYear;year<lYear;year++){
      offset += getLunarYearDays(year);
  }
  for(let month=1;month<lMonth||isLeap&&month==lMonth&&lMonth==leapMonth;month++){
      offset += data&1<<(16 - month)?30:29;
  }
  if(leapMonth&&lMonth>leapMonth){
      offset += data&1<<16?30:29;
  }
  offset += lDay;
  return startTime+offset*86400000;
}
// 时间戳转农历日期
function getLunarByTimestamp(timestamp){
  let offset = Math.floor((timestamp - startTime)/86400000);
  let lYear = 0, lMonth = 0, lDay = 0, isLeap = false;
  let days;
  if(offset<=0){
      return null;
  }
  let count = 0;
  for(lYear = minYear; lYear<=maxYear; lYear++){
      days = getLunarYearDays(lYear);
      if(count + days>=offset){
          break;
      }
      count+= days;
  }
  let data = parseInt(monthData[lYear - minYear],32);
  let leapMonth = getLeapMonth(lYear);
  offset -= count;
  count = 0;
  for(lMonth=1;lMonth<=12;lMonth++){
      days = data&1<<(16 - lMonth)?30:29;
      if(count+days>=offset){
          break;
      }
      count += days;
      if(leapMonth&&lMonth==leapMonth){
          days = data&1<<16?30:29;
          if(count+days>=offset){
              isLeap = true;
              break;
          }
          count += days;
      }
  }
  lDay = offset-count;
  return {
      lYear:lYear,
      lMonth:lMonth,
      lDay:lDay,
      isLeap:isLeap,
      lMonthZH:(isLeap?'闰':'')+monthMap[lMonth-1]+'月',
      lDayZH:dayMap[lDay-1]
  };
}

// 干支纪年
const ganMap = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const zhiMap = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
// 获取干支年: 1984年为甲子年
function getGanZhiYear(lYear){
  let gzIndex = lYear - 1984;
  gzIndex = gzIndex%60>0?gzIndex%60:gzIndex%60+60;
  let gan = gzIndex%10;
  let zhi = gzIndex%12;
  return ganMap[gan]+zhiMap[zhi];
}

// 12生肖
const animalMap = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
// 获取生肖纪年: 1984年为鼠年
function getAnimalYear(sYear){
  let diff = sYear - 1984;
  let animal = diff%12;
  return animalMap[animal>-1?animal:animal+12];
}

// 星座
const zodiacMap = ['水瓶','双鱼','白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯'];
const zodiacDate = [20,19,21,20,21,22,23,23,23,24,23,22];
// 获取星座
function getZodiac(sMonth,sDay){
  let zoIndex = 11;
  zodiacDate.forEach(function(day,index){
      let month = index+1;
      if(getDateString(sMonth,sDay)>=getDateString(month,day)){
          zoIndex = index%12;
      }
  });
  return zodiacMap[zoIndex]+'座';
}