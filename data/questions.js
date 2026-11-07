/* ===== QUESTION DATABASE =====
   Edit freely in VS Code. Each question:
   level:  easy | medium | hard      (points 1 / 2 / 3)
   topic:  any label - this is the "coverage" she can pick from
   options: list of answers, answer = index of the correct one (0 = first)
*/
window.QUESTION_BANK = {
  id: "starter",
  name: "Starter Mandarin (built-in)",
  version: 1,
  questions: [
    // ---------- EASY ----------
    {id:"E01",level:"easy",topic:"Greetings",prompt:"你好",pinyin:"nǐ hǎo",options:["Hello","Goodbye","Thank you","Sorry"],answer:0,explain:"你好 = hello."},
    {id:"E02",level:"easy",topic:"Greetings",prompt:"谢谢",pinyin:"xièxie",options:["Sorry","Please","Thank you","Hello"],answer:2,explain:"谢谢 = thank you."},
    {id:"E03",level:"easy",topic:"Numbers",prompt:"三",pinyin:"sān",options:["1","3","5","7"],answer:1,explain:"一 二 三 = 1 2 3."},
    {id:"E04",level:"easy",topic:"Numbers",prompt:"八",pinyin:"bā",options:["6","7","8","9"],answer:2,explain:"八 = 8."},
    {id:"E05",level:"easy",topic:"Colors",prompt:"红色",pinyin:"hóngsè",options:["Blue","Red","Green","Yellow"],answer:1,explain:"红色 = red."},
    {id:"E06",level:"easy",topic:"Family",prompt:"妈妈",pinyin:"māma",options:["Father","Mother","Sister","Grandma"],answer:1,explain:"妈妈 = mom."},
    {id:"E07",level:"easy",topic:"Animals",prompt:"猴子",pinyin:"hóuzi",options:["Dog","Bear","Monkey","Cat"],answer:2,explain:"猴子 = monkey 🐵"},
    {id:"E08",level:"easy",topic:"Food",prompt:"水",pinyin:"shuǐ",options:["Rice","Tea","Water","Milk"],answer:2,explain:"水 = water."},
    // ---------- MEDIUM ----------
    {id:"M01",level:"medium",topic:"Greetings",prompt:"How do you say “Good morning”?",pinyin:"",options:["早上好","晚安","再见","对不起"],answer:0,explain:"早上好 zǎoshang hǎo."},
    {id:"M02",level:"medium",topic:"Numbers",prompt:"二十五",pinyin:"èrshíwǔ",options:["15","25","52","35"],answer:1,explain:"二十 = 20, 五 = 5."},
    {id:"M03",level:"medium",topic:"Time",prompt:"今天",pinyin:"jīntiān",options:["Today","Tomorrow","Yesterday","Now"],answer:0,explain:"明天 = tomorrow, 昨天 = yesterday."},
    {id:"M04",level:"medium",topic:"Food",prompt:"我想吃苹果。",pinyin:"wǒ xiǎng chī píngguǒ",options:["I want to eat an apple.","I want to eat rice.","I like noodles.","I want to drink tea."],answer:0,explain:"苹果 = apple."},
    {id:"M05",level:"medium",topic:"Places",prompt:"学校",pinyin:"xuéxiào",options:["School","Hospital","Store","Park"],answer:0,explain:"学校 = school."},
    {id:"M06",level:"medium",topic:"Grammar",prompt:"一___书 (one book)",pinyin:"yī ___ shū",options:["本","个","只","杯"],answer:0,explain:"本 is the measure word for books."},
    {id:"M07",level:"medium",topic:"Sentences",prompt:"你叫什么名字？",pinyin:"nǐ jiào shénme míngzi?",options:["What is your name?","Where are you from?","How old are you?","How are you?"],answer:0,explain:"A common way to ask someone's name."},
    {id:"M08",level:"medium",topic:"Family",prompt:"Which word means “younger brother”?",pinyin:"",options:["哥哥","弟弟","姐姐","妹妹"],answer:1,explain:"哥哥 = older brother, 弟弟 = younger brother."},
    // ---------- HARD ----------
    {id:"H01",level:"hard",topic:"Grammar",prompt:"我___吃过榴莲。 (I have never eaten durian.)",pinyin:"wǒ ___ chī guo liúlián",options:["从来没","不会","别","还"],answer:0,explain:"从来没……过 = have never done."},
    {id:"H02",level:"hard",topic:"Grammar",prompt:"Which sentence is correct? (Please close the door.)",pinyin:"",options:["请把门关上。","请门把关上。","请关把门上。","把请门关上。"],answer:0,explain:"把 structure: 把 + object + verb."},
    {id:"H03",level:"hard",topic:"Sentences",prompt:"虽然下雨，___我们还是去公园。",pinyin:"suīrán xià yǔ, ___ wǒmen háishi qù gōngyuán",options:["但是","因为","所以","如果"],answer:0,explain:"虽然……但是 = although…, still…"},
    {id:"H04",level:"hard",topic:"Characters",prompt:"Which is the correct word for “library”?",pinyin:"túshūguǎn",options:["图书馆","图书官","图书管","国书馆"],answer:0,explain:"馆 (guǎn) is used for buildings like 图书馆."},
    {id:"H05",level:"hard",topic:"Time",prompt:"现在是下午三点半。",pinyin:"xiànzài shì xiàwǔ sān diǎn bàn",options:["3:30 PM","3:30 AM","5:30 PM","3:13 PM"],answer:0,explain:"下午 = afternoon, 半 = half past."},
    {id:"H06",level:"hard",topic:"Idioms",prompt:"一石二鸟",pinyin:"yī shí èr niǎo",options:["Kill two birds with one stone","Look before you leap","Birds of a feather","A drop in the ocean"],answer:0,explain:"Literally: one stone, two birds."},
    {id:"H07",level:"hard",topic:"Grammar",prompt:"他比我高。",pinyin:"tā bǐ wǒ gāo",options:["He is taller than me.","I am taller than him.","He is as tall as me.","He is not tall."],answer:0,explain:"A 比 B + adjective = A is more … than B."},
    {id:"H08",level:"hard",topic:"Sentences",prompt:"你能帮我一个忙吗？",pinyin:"nǐ néng bāng wǒ yí ge máng ma?",options:["Can you do me a favor?","Can you find a shop?","Do you have time?","Where is the bathroom?"],answer:0,explain:"帮忙 = help / do a favor."}
  ]
};
