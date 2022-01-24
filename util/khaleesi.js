const KhaleesiPostCorrection = {
	/**
	 * @param {string[]} iWords
	 * @returns {string[]}
	 */
	getPostCorrection: iWords => {
		let result = new Array();

		iWords.forEach((word) => {
			if (word.length < 2) return result.push(word);

			if (/ийи/gi.test(word))
				return result.push(word.replace(/(и)й(и)/gi, "$1$2"));

			if (/^(сьто|чьто)/.test(word)) {
				let randomWhat = KhaleesiPostCorrection.WHATS[Math.floor(KhaleesiPostCorrection.WHATS.length * Math.random())];
				return result.push(word.replace(/^(сьто|чьто)/, randomWhat));
			};

			result.push(KhaleesiPostCorrection.randomMixWord(word))
		});

		return result;
	},

	/**
	 * @param {string} word
	 * @returns {string}
	 */
	randomMixWord: (word) => {
		let mixedUpRules = KhaleesiPostCorrection.POST_CORRECTION_RULES.slice(0);

		for (let i = mixedUpRules.length - 1; i > 0; i--) {
			let j = Math.floor(Math.random() * i);
			[mixedUpRules[i], mixedUpRules[j]] = [mixedUpRules[j], mixedUpRules[i]];
		};

		mixedUpRules.slice(0, 10).forEach((rule) => {
			let [from, to] = rule;
			if (word.search(from) > -1)
				word = word.replace(from, to);
		});

		return word;
	},

	WHATS: [
		"чьто", "сто", "шьто", "што"
	],

	POST_CORRECTION_RULES: [
		["ожк", "озьг"],
		["кол", "га"],
		["ко", "га"],
		["колгот", "гагот"],
		["шо", "ша"],
		["дка", "ка"],
		["он", "онь"],
		["б", "п"],
		["хи", "ни"],
		["шк", "к"],
		["тро", "го"],
		["тка", "пка"],
		["кров", "кав"],
		["ра", "я"],
		["дюк", "дю"],
		["ойд", "анд"],
		["дка", "та"],
		["ро", "мо"],
		["ны", "ни"],
		["ре", "е"],
		["ле", "не"],
		["ки", "ке"],
		["ш", "ф"],
		["шка", "вха"],
		["гри", "ги"],
		["ч", "щ"],
		["ре", "ле"],
		["го", "хо"],
		["ль", "й"],
		["иг", "ег"],
		["ра", "ва"],
		["к", "г"],
		["зо", "йо"],
		["зо", "ё"],
		["рё", "йо"],
		["ск", "фк"],
		["ры", "вы"],
		["шо", "фо"],
		["ло", "ле"],
		["сы", "фи"],
		["еня", "ея"],
		["пель", "пюль"],
		["а", "я"],
		["у", "ю"],
		["о", "ё"],
		["ща", "ся"],
		["ы", "и"],
		["ри", "ви"],
		["ло", "во"],
		["е", "и"],
		["и", "е"],
		["а", "о"],
		["о", "а"]
	]
};

const KhaleesiUtils = {
	/**
	 * @param {string} iString
	 * @returns {string[]}
	 */
	getWords: iString => iString.split(/(\s+)/),

	/**
	 * @param {string} iWord
	 * @returns {boolean}
	 */
	hasCyrillics: iWord => /[а-я]/i.test(iWord),

	/**
	 * @param {string} iWord
	 * @returns {Array.<[string, string, string]>}
	 */
	previousAndNext: iWord => {
		let result = new Array();

		for (let i = 0; i < iWord.length; i++)
			result.push([
				(i == 0 ? "" : iWord[i - 1]),
				iWord[i],
				(i == iWord.length - 1 ? "" : iWord[i + 1])
			]);

		return result;
	},

	/**
	 * @param {string} iChar
	 * @param {string} iReplacement
	 * @returns {string}
	 */
	replaceWithCase: (iChar, iReplacement) => {
		if (iChar.toUpperCase() === iChar)
			return iReplacement.toUpperCase();
		else
			return iReplacement.toLowerCase();
	},
};

const KhaleesiEngine = {
	/** @type {{[x: string]: Array.<{regexp: RegExp, replacement: string}>}} */
	globalReplaces: new Object(),

	VOWELS: "аеёиоуыэюя",
	CONSONANTS: "йцкнгшщзхфвпрлджбтмсч",

	/** @type {{[x: string]: string[]}} */
	REPLACES_RULES: {
		/**
		 * @ означает текущую букву
		 * ^ и $ - начало/конец слова (как в регулярных выражениях)
		 * С и Г - любая согласная/гласная буквы
		 * до знака "=" у нас искомый паттерн, а после знака – на что мы будем заменять эту букву
		 * Символ точки – любая буква или символ
		 */

		'а': [
			'^ @ .  = @',
			'[тбвкпмнг]@$  = я',
			'. @ $  = @',
			'. @ я  = @',
			'С @ .  = я',
			'Г @ .  = я',
		],
		'в': [
			'з @ . = ь@'
		],
		'е': [
			'. @ С + $ = @',
			'С @ .   = и',
			'Г @ .   = и',
		],
		'ж': [
			'. @ . = з',
		],
		'л': [
			'^ @ . = @',
			'. @ $ = @',
			'. @р$ = @',
			'л @ . = @@',
			'. @к  = @',
			'. @п  = @',
			'С @ . = @',
			'Г @ . = _',
		],
		'н': [
			'ко@$ = нь',
		],
		'о': [
			'[мпжзгтс]@[цкнгшщзхфвпджбтмсч] = ё',
		],
		'р': [
			'^дра = _',
			'^ @ . = л',
			'Г @ . = й',
			'С @ . = ь',
		],
		'у': [
			'^ @ . = @',
			'. @ . = ю',
		],
		'ч': [
			'^что = сь',
		],
		'щ': [
			'^тыщ$ = сь',
			'^ @ . = @',
			'. @ . = с',
		],
		'ь': [
			'л@ .  = й',
			'. @ $ = @',
			'.@Г$  = @',
			'С@ .  = @',
			'. @ . = й',
		],
	},

	/**
	 * @returns {{[x: string]: Array.<{regexp: RegExp, replacement: string}>}}
	 */
	getReplaces: () => {
		/* Теперь на основе этих глобальных правил делаем регулярные выражения */
		let tripplesObj = new Object();

		for (let char in KhaleesiEngine.REPLACES_RULES) {
			let stringPatterns = KhaleesiEngine.REPLACES_RULES[char];

			/** @type {Array.<{regexp: RegExp, replacement: string}>} */
			let tripples = new Array();

			stringPatterns.forEach((stringPattern) => {
				let regexpPatternArr = new Array(),
					[search, replacement] = stringPattern.split("=");
					replacement = replacement.trim().replace(/\@/g, char);

				if (replacement == "_")
					replacement = "";


				regexpPatternArr.push("(");
				search.replace(/\s/g, "").split("").forEach((element) => {
					if (element == "@")
						regexpPatternArr.push(`)(${char})(`);
					else if (element == "Г")
						regexpPatternArr.push("[ьъаеёиоуыэюя]");
					else if (element == "С" | element == "C")
						regexpPatternArr.push("[ьъйцкнгшщзхфвпрлджбтмсч]");
					else
						regexpPatternArr.push(element);
				});
				regexpPatternArr.push(")");

				let regexp = new RegExp(regexpPatternArr.join(""), "i");

				tripples.push({ regexp, replacement });
			});

			tripplesObj[char] = tripples;
		};

		return tripplesObj;
	},

	/**
	 * @param {string} iWord
	 * @returns {string}
	 */
	replaceWord: iWord => {
		if (!Object.keys(KhaleesiEngine.globalReplaces).length)
			KhaleesiEngine.globalReplaces = KhaleesiEngine.getReplaces();

		if (!KhaleesiUtils.hasCyrillics(iWord))
			return iWord;

		let result = new Array();

		KhaleesiUtils.previousAndNext(iWord).forEach((group, groupIndex) => {
			let [prevChar, currentChar, nextChar] = group;

			let lowerCurrentChar = currentChar.toLowerCase();


			if (KhaleesiEngine.globalReplaces[lowerCurrentChar])
				result.push(
					KhaleesiEngine.replaceChar({
						prevChar, currentChar, nextChar, lowerCurrentChar, groupIndex,
						word: iWord
					})
				);
			else
				result.push(currentChar);
		});

		return result.join("");
	},

	/**
	 * @param {{prevChar: string, currentChar: string, nextChar: string, lowerCurrentChar: string, word: string, groupIndex: number}} iObj
	 * @returns {string}
	 */
	replaceChar: (iObj) => {
		let {prevChar, currentChar, nextChar, lowerCurrentChar, word, groupIndex} = iObj,
			currentCharReplacedFlag = false,
			replacedChar = currentChar;

		KhaleesiEngine.globalReplaces[lowerCurrentChar].forEach((tripple) => {
			if (currentCharReplacedFlag) return;


			if (tripple.regexp.test(prevChar + currentChar + nextChar)) {
				replacedChar = (prevChar + currentChar + nextChar).replace(tripple.regexp, tripple.replacement);
				currentCharReplacedFlag = true;


				replacedChar = replacedChar.toLowerCase();
				if (currentChar !== lowerCurrentChar)
					replacedChar = replacedChar.toUpperCase();

				return;
			};
		});


		return replacedChar;
	}
};

/**
 * При необходимости заменяем на `const Khaleesi`
 *
 * @param {string} iMessage
 * @returns {string}
 */
module.exports = iMessage => {
	let result = new Array();

	KhaleesiUtils.getWords(iMessage.trim()).map((word) => {
		if (word.length < 2)
			result.push(word);
		else
			result.push(KhaleesiEngine.replaceWord(word));
	});

	return KhaleesiPostCorrection.getPostCorrection(result).join("");
};