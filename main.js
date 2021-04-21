// https://www.npmjs.com/package/pos
// http://thesaurus.altervista.org/

var API_KEY = "Wv8HBzFcSDWmmDNSDqBU";

synonyms = {};
var numCompletedRequests = 0;

var posMap = {
	JJ: "adj",
	JJR: "adj",
	JJS: "adj",
	NN: "noun",
	NNS: "noun",
	NNP: "noun",
	RB: "adv",
	RBR: "adv",
	RBS: "adv",
	VB: "verb",
	VBD: "verb",
	VBG: "verb",
	VBN: "verb",
	VBP: "verb",
	VBZ: "verb",
};

var posMod = {
	NNS: {
		// plural noun
		toOriginalForm: function (word) {
			if (word.endsWith("y")) {
				return word.substring(0, word.length - 1) + "ies";
			} else if (word.endsWith("ss") || word.endsWith("x")) {
				return word + "es";
			}
			return word + "s";
		},
		fromOriginalForm: function (word) {
			if (word.endsWith("ness")) {
				// incorrectly identified plural noun!  do nothing.
				return null;
			} else if (word.endsWith("ies")) {
				return [word.substring(0, word.length - 3) + "y"];
			} else if (word.endsWith("sses") || word.endsWith("xes")) {
				return [word.substring(0, word.length - 2)];
			} else if (word.endsWith("s")) {
				return [word.substring(0, word.length - 1)];
			}
			return null;
		}
	},
	VBD: {
		// verb, past tense
		toOriginalForm: function (word) {
			var words = word.split(" ");
			if (words[0].endsWith("e")) {
				words[0] += "d";
			} else {
				words[0] += "ed";
			}
			return words.join(" ");
		},
		fromOriginalForm: function (word) {
			if (word.endsWith("ed")) {
				return [word.substring(0, word.length - 1), word.substring(0, word.length - 2)];
			}
			return null;
		}
	},
	VBG: {
		// verb, gerund
		toOriginalForm: function (word) {
			var words = word.split(" ");
			if (words[0].endsWith("e")) {
				words[0] = words[0].substring(0, words[0].length - 1);
			}
			words[0] += "ing";
			return words.join(" ");
		},
		fromOriginalForm: function (word) {
			if (word.endsWith("ing")) {
				var minusSuffix = word.substring(0, word.length - 3);
				return [minusSuffix, minusSuffix + "e"];
			}
			return null;
		}
	},
	VBN: {
		// verb, past participle
		// this is just impossible, because English is such a disaster
		// viz. "eaten" vs. "created"
		toOriginalForm: function (word) {
			return word;
		},
		fromOriginalForm: function (word) {
			return null;
		},
	},
	VBZ: {
		// verb, present 3rd person singular
		toOriginalForm: function (word) {
			if (word == "be") {
				return "is";
			}
			var words = word.split(" ");
			words[0] += "s";
			return words.join(" ");
		},
		fromOriginalForm: function (word) {
			if (word.endsWith("s")) {
				return [word.substring(0, word.length - 1)];
			}
			return null;
		}
	}
};

function onLoad() {
	showText(0);
	var linksHtml = "";
	for (var i in sampleTexts) {
		linksHtml += "<a href=\"#\" onClick=\"showText(" + i + ");\">" + sampleTexts[i].tag + "</a>";
	}
	$("#sample-text-links").html(linksHtml);
}

function showText(i) {
	if (i || i == 0) {
		$("#in-text").val(sampleTexts[i].text);
		go();
	} else {
		$("#in-text").val(null);
		$("#in-text").focus();
	}
}

function hideWord() {
	var replacedWordPopup = $("#replaced-word-popup");
	replacedWordPopup.css("display", "none");
}

function showWord(element, word) {
	var rect = element.getBoundingClientRect();
	//	console.log(rect.top, rect.right, rect.bottom, rect.left);
	var replacedWordPopup = $("#replaced-word-popup");
	replacedWordPopup.html(word);
	replacedWordPopup.css("top", (rect.top - 38 + window.scrollY) + "px");
	replacedWordPopup.css("left", rect.left + "px");
	replacedWordPopup.css("display", "block");
}

function go() {
	var numModifiedWords = 0;
	var progress = $("#progress");
	var progressContainer = $("#progress-container");
	$("#go-container").css("display", "none");
	progressContainer.css("display", "block");

	var text = $("#in-text").val();
	text = text.replace(/--/g, " -- ");
	text = text.replace(/:/g, " : ");
	text = text.replace(/\n/g, " _CRLF_ ");
	//	var words = text.split(/\b\s*/);
	var pos = [];
	var modifiedWordIndexes = [];

	var taggedWords = new POSTagger().tag(new Lexer().lex(text));
	for (i in taggedWords) {
		var taggedWord = taggedWords[i];
		var word = taggedWord[0];
		if (word == "_CRLF_") {
			numCompletedRequests++;
			pos.push(null);
		} else {
			//		console.log(i + " " + word);
			var tag = taggedWord[1];
			pos.push(posMap[tag] || null);

			if (posMod[tag]) {
				var modifiedWords = posMod[tag].fromOriginalForm(word);
				if (modifiedWords) {
					numModifiedWords += modifiedWords.length - 1;
					modifiedWordIndexes.push(i);
					for (var j in modifiedWords) {
						addSynonyms(modifiedWords[j]);
					}
				} else {
					addSynonyms(word);
				}
			} else if (posMap[tag]) {
				addSynonyms(word);
			} else {
				numCompletedRequests++;
			}
		}
	}

	var completeCheckIntervalId = setInterval(function () {
		var doneRatio = numCompletedRequests / (taggedWords.length + numModifiedWords);
		progress.css("width", (100 * doneRatio) + "%");
		//		console.log(numCompletedRequests + " / " + (taggedWords.length + numModifiedWords));
		if (doneRatio >= 1) {
			clearInterval(completeCheckIntervalId);
			numCompletedRequests = 0;
			var output = "";
			for (var i in taggedWords) {
				var word = taggedWords[i][0];
				var replacement = word;
				var originalReplacement = replacement;
				if (word == "_CRLF_") {
					replacement = "<br/>";
				} else {
					if (modifiedWordIndexes.includes(i)) {
						var tag = taggedWords[i][1];
						var modifiedWords = posMod[tag].fromOriginalForm(word);
						for (var j in modifiedWords) {
							var lcWord = modifiedWords[j].toLowerCase();
							if (synonyms[lcWord] && pos[i] && synonyms[lcWord][pos[i]] && synonyms[lcWord][pos[i]].length > 0) {
								replacement = synonyms[lcWord][pos[i]][parseInt(synonyms[lcWord][pos[i]].length * Math.random())];
								originalReplacement = replacement;
								replacement = posMod[tag].toOriginalForm(replacement);
								console.log("replacing '" + word + "' with transformed word: " + replacement);
								break;
							}
						}
					} else {
						var lcWord = word.toLowerCase();
						//				console.log(word + " : " + words[i]);
						if (synonyms[lcWord] && pos[i] && synonyms[lcWord][pos[i]] && synonyms[lcWord][pos[i]].length > 0) {
							replacement = synonyms[lcWord][pos[i]][parseInt(synonyms[lcWord][pos[i]].length * Math.random())];
							originalReplacement = replacement;
							console.log("replacing '" + word + "' with word: " + replacement);
						}
					}
					if (word[0].match(/[A-Z]/)) {
						replacement = replacement[0].toUpperCase() + replacement.substring(1);
					}
				}
				if (lcWord.match(/^[a-z'-]+$/)) {
					output += " ";
				}
				if (replacement == word || word == "_CRLF_") {
					output += replacement;
				} else {
					var dictionaryUrl = "https://www.merriam-webster.com/dictionary/" + originalReplacement;
					output += "<a target=\"definition\" href=\"" + dictionaryUrl + "\"  class=\"replaced-word\" onMouseOver=\"showWord(this, '" + word
						+ "');\" onMouseOut=\"hideWord();\" >" + replacement + "</a>";
				}
			}
			$("#output").html(output);
			$("#output").css("display", "block");
			progressContainer.css("display", "none");
			$("#go-container").css("display", "block");
		}
	}, 200);
}

function parseThesaurusResults(data, isSynonyms) {
	var categories = {};
	for (i in data.response) {
		// console.log(i, data.response[i]);
		var results = data.response[i].list.synonyms.split("|");
		var categoryKey = data.response[i].list.category;
		categoryKey = categoryKey.substring(1, categoryKey.length - 1);
		var category = categories[categoryKey] || [];
		for (var j in results) {
			var word = results[j];
			var isAntonym = word.endsWith("(antonym)");
			if (!isAntonym && word.match(/\(.*\)$/)) {
				console.log("ignoring word: " + word);
			} else if (isSynonyms != isAntonym) {
				if (isAntonym) {
					word = word.substring(0, word.length - "(antonym)".length);
				}
				category.push(word);
				categories[categoryKey] = category;
			}
		}
	}
	return categories;
}

function displayOutput(categories, id) {
	var output = "";
	for (var category in categories) {
		output += category + ":<ul>";
		for (var i in categories[category]) {
			output += "<li>" + categories[category][i] + "</li>";
		}
		output += "</ul>";
	}
	$("#" + id).html(output);
}

function addSynonyms(word) {
	if (synonyms[word] || !word.match(/^[a-z]{3,}$/i)) {
		numCompletedRequests++;
	} else {
		var url = "http://thesaurus.altervista.org/thesaurus/v1?word=" + word + "&language=en_US&output=json&key=" + API_KEY;
		//		console.log("request", url);
		$.ajax({
			url: url,
			success: function (data) {
				synonyms[word.toLowerCase()] = parseThesaurusResults(data, true);
				numCompletedRequests++;
				//				console.log("added " + word + ". numCompletedRequests = " + numCompletedRequests);
			},
			error: function (xhr, status, error) {
				numCompletedRequests++;
			}
		});
	}
}
