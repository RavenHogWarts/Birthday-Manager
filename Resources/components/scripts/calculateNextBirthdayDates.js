exports.default = {
  entry: calculateNextBirthdayDates,
  scopes: ['formula'],
  description: `
  根据公历生日或农历生日，计算下一个生日日期。
  # 文档属性
  你的文档需要包含以下属性：
  - \`birthdaySolar\`: 公历生日，格式为 "YYYY-MM-DD", 如2004-12-21
  - \`birthdayLunar\`: 农历生日，格式为 "YYYY年MM月DD日"，全中文，如二〇〇四年腊月廿一
  - \`birthdayType\`: 生日类型，有 "Lunar","Solar" (或"农历","公历") 两种
  # 映射表
  - \`农历月映射表\`：['正','二','三','四','五','六','七','八','九','十','冬','腊']
  - \`农历日映射表\`：['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  `
}

async function calculateNextBirthdayDates() {
  const file = this.currentFile;
  const metadata = app.metadataCache.getFileCache(file);
  const frontmatter = metadata?.frontmatter;

  let birthdaySolar = frontmatter?.["birthdaySolar"];
  let birthdayLunar = frontmatter?.["birthdayLunar"];
  const birthdayType = frontmatter?.["birthdayType"];
  let nextBirthday;

  if(birthdaySolar && (birthdayType == "Solar" || birthdayType == "公历")){
    const lunarBirthday = convertSolarToLunar(birthdaySolar, "Zh");
    let [formatNextBirthday, nextLunarBirthday] = getNextSolarBirthday(birthdaySolar);

    updateFrontMatter(file, (frontmatter) => {
      frontmatter["birthdayLunar"] = lunarBirthday;
      frontmatter["nextBirthday"] = formatNextBirthday;
      frontmatter["nextBirthdayString"] = `公历：${formatNextBirthday} <span style=\"color:#086ddd\">（农历：${nextLunarBirthday}）</span>`;
    });
  }
  else if(birthdayLunar && (birthdayType == "Lunar" || birthdayType == "农历")){
    birthdayLunar = birthdayLunar.replace(/零/g, "〇");
    const solarBirthday = convertLunarToSolar(birthdayLunar, "Zh");
    let [formatNextBirthday, nextLunarBirthday] = getNextLunarBirthday(birthdayLunar);

    updateFrontMatter(file, (frontmatter) => {
      frontmatter["birthdaySolar"] = solarBirthday;
      frontmatter["nextBirthday"] = formatNextBirthday;
      frontmatter["nextBirthdayString"] = `公历：${formatNextBirthday} <span style=\"color:#086ddd\">（农历：${nextLunarBirthday}）</span>`;
    });
  }
  else{
    return "请根据生日类型填写对应生日日期";
  }

  // 更新
  birthdaySolar = frontmatter?.["birthdaySolar"];
  birthdayLunar = frontmatter?.["birthdayLunar"].replace(/零/g, "〇");
  nextBirthday = frontmatter?.["nextBirthday"];

  const animal = getAnimalByLunar(birthdayLunar);
  const zodiac = getZodiacBySolar(birthdaySolar);

  updateFrontMatter(file, (frontmatter) => {
    frontmatter["animal"] = animal;
    frontmatter["zodiac"] = zodiac;
  });

  return getDaysUntilNextBirthday(birthdaySolar, nextBirthday);
}

function updateFrontMatter(file, updateFrontmatterFunc) {
  app.fileManager.processFrontMatter(file, (frontmatter) => {
      updateFrontmatterFunc(frontmatter);
  });
}

// 数字与中文映射
const yearZhMap = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
// 获取中文年份
function getYearZh(year){
  return String(year).split('').map(num => yearZhMap[Number(num)]).join('');
}
// 获取数字年份
function getYearNum(zhYear){
  return parseInt(zhYear.split('').map(char => yearZhMap.indexOf(char)).join(''), 10);
}

// 解析农历日期（数字年份）
function parseLunarDateNumYear(lunarDate){
  const [lunarYearText, lunarMonthText, lunarDayText] = lunarDate.match(/(\d{4})年(闰?[^月]+)月(.+)/).slice(1);
  const lunarYear = getYearNum(lunarYearText);
  const lunarMonth = monthMap.indexOf(lunarMonthText.replace("闰", "")) + 1;
  const lunarDay = dayMap.indexOf(lunarDayText) + 1;
  const isLeap = monthText.startsWith("闰");

  const lunarDateObj = {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap: isLeap,
  };
  return lunarDateObj;
}
// 解析农历日期（中文年份）
function parseLunarDateZhYear(lunarDate){
  const [lunarYearText, lunarMonthText, lunarDayText] = lunarDate.match(/(.+)年(闰?[^月]+)月(.+)/).slice(1);
  const lunarYear = getYearNum(lunarYearText);
  const lunarMonth = monthMap.indexOf(lunarMonthText.replace("闰", "")) + 1;
  const lunarDay = dayMap.indexOf(lunarDayText) + 1;
  const isLeap = lunarMonthText.startsWith("闰");

  const lunarDateObj = {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap: isLeap,
  };
  return lunarDateObj;
}

// 从公历日期转换为农历日期
function convertSolarToLunar(solarDate, lunarYearType = "Num"){
  const [solarYear, solarMonth, solarDay] = solarDate.split("-").map(Number);
  const timestamp = getTimestampBySolar(solarYear, solarMonth, solarDay);
  const lunarDate = getLunarByTimestamp(timestamp);

  let lunarYearText = lunarDate.lYear;

  if(lunarYearType == "Zh"){
    lunarYearText = getYearZh(lunarDate.lYear);
  }

  const lunarMonthText = lunarDate.isLeap ? `闰${monthMap[lunarDate.lMonth - 1]}` : monthMap[lunarDate.lMonth - 1];
  const lunarDayText = dayMap[lunarDate.lDay - 1];

  const lunarDateString = `${lunarYearText}年${lunarMonthText}月${lunarDayText}`;

  return lunarDateString;
}
// 从农历日期转换为公历日期
function convertLunarToSolar(lunarDate, lunarYearType = "Num"){
  let lunarDateObj;
  if(lunarYearType == "Zh"){
    lunarDateObj = parseLunarDateZhYear(lunarDate);
  }else if(lunarYearType == "Num"){
    lunarDateObj = parseLunarDateNumYear(lunarDate);
  }

  const timestamp = getTimestampByLunar(lunarDateObj.year, lunarDateObj.month, lunarDateObj.day, lunarDateObj.isLeap);
  const solarDate = getSolarByTimestamp(timestamp);

  const solarDateString = `${solarDate.sYear}-${String(solarDate.sMonth).padStart(2, "0")}-${String(solarDate.sDay).padStart(2, "0")}`;

  return solarDateString;
}

// 获取下一个生日
function getNextSolarBirthday(birthdaySolar){
  // 获取下一个公历生日并更新
  const [solarYear, solarMonth, solarDay] = birthdaySolar.split("-").map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();

  let nextYear = currentYear;
  if (now.getMonth() + 1 > solarMonth || (now.getMonth() + 1 === solarMonth && now.getDate() > solarDay)) {
    nextYear += 1;
  }

  const nextSolarBirthday = {
    sYear: nextYear,
    sMonth: solarMonth,
    sDay: solarDay,
  };

  const nextLunarBirthday = convertSolarToLunar(nextSolarBirthday.sYear + "-" + nextSolarBirthday.sMonth + "-" + nextSolarBirthday.sDay, "Zh");

  const formatNextBirthday = getDateString(nextSolarBirthday.sYear, nextSolarBirthday.sMonth, nextSolarBirthday.sDay);

  return [formatNextBirthday, nextLunarBirthday];
}
function getNextLunarBirthday(birthdayLunar){
  // 获取下一个农历生日并更新
  const lunarDateObj = parseLunarDateZhYear(birthdayLunar);

  const currentTimestamp = Date.now();
  const currentLunar = getLunarByTimestamp(currentTimestamp);

  let nextLunarYear = currentLunar.lYear;
  if (
    lunarDateObj.month < currentLunar.lMonth ||
    (lunarDateObj.month === currentLunar.lMonth && lunarDateObj.day <= currentLunar.lDay)
  ) {
    nextLunarYear += 1;
  }

  const nextLunarTimestamp = getTimestampByLunar(
    nextLunarYear,
    lunarDateObj.month,
    lunarDateObj.day,
    false // 农历生日的计算不处理闰月
  );

  let nextSolarBirthday = getSolarByTimestamp(nextLunarTimestamp);
  
  // 检查农历月是否有三十日，如果没有，则调整到廿九
  const lunarMonthDays = getLunarMonthDays(nextLunarYear, lunarDateObj.month, getLeapMonth(nextLunarYear));
  if (lunarDateObj.day > lunarMonthDays) {
    nextSolarBirthday.sDay -= 1;
  }

  const nextLunarBirthday = convertSolarToLunar(nextSolarBirthday.sYear + "-" + nextSolarBirthday.sMonth + "-" + nextSolarBirthday.sDay, "Zh");

  const formatNextBirthday = getDateString(nextSolarBirthday.sYear, nextSolarBirthday.sMonth, nextSolarBirthday.sDay);

  return [formatNextBirthday, nextLunarBirthday];
}

function getAnimalByLunar(birthdayLunar){
  // 根据农历生日获取生肖
  const lunarDateObj = parseLunarDateZhYear(birthdayLunar);
  const lunarYear = lunarDateObj.year;

  const ganzhi = getGanZhiYear(lunarYear);
  const animal = getAnimalYear(lunarYear);
  const chineseZodiac = `${ganzhi}年 ${animal}`;

  return chineseZodiac;
}

function getZodiacBySolar(birthdaySolar){
  // 根据公历生日获取星座
  const [solarYear, solarMonth, solarDay] = birthdaySolar.split("-").map(Number);
  const zodiac = getZodiac(solarMonth, solarDay);

  return zodiac;
}

function getDaysUntilNextBirthday(birthdaySolar, nextBirthday){
  const birthdayDate = new Date(birthdaySolar);
  const nextBirthdayDate = new Date(nextBirthday);
  const now = new Date();
  const diff = nextBirthdayDate - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const nextAge = nextBirthdayDate.getFullYear() - birthdayDate.getFullYear();

  const String = `${nextAge}岁生日还有${days}天`;
  return String;
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
  let data = parseInt(monthData[lYear - minYear],32);
  let days = (isLeap?data&1<<16:1<<(17-lMonth))?30:29;
  if(lDay>days){
      return null;
  }
  // 时间戳获取
  let offset = 0;
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