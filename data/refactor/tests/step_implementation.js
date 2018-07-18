/* globals gauge*/

"use strict";

var assert = require("assert");

var vowels = ["a", "e", "i", "o", "u"];

var numberOfVowels = function (word) {
  var vowelArr = word.split("").filter(function (elem) { return vowels.indexOf(elem) > -1; });
  return vowelArr.length;
};

step("Vowels in English language are <vowels>.", function(vowelsGiven) {
  assert.equal(vowelsGiven, vowels.join(""));
});

step("The word <word> has <number> vowels.", function(word, number) {
  assert.equal(number, numberOfVowels(word));
});

step("Almost all words have vowels <table>", function(table) {
  table.rows.forEach(function (row) {
    assert.equal(numberOfVowels(row.cells[0]), parseInt(row.cells[1]));
  });
});

step("something", function() {
});

beforeScenario(function () {
  assert.equal(vowels.join(""), "aeiou");
});

beforeScenario(function () {
  assert.equal(vowels[0], "a");
}, { tags: [ "single word" ]});

step("a basic step", async function () {
	throw 'Unimplemented Step';
});

step("a basic step <param>", async function (arg0) {
	throw 'Unimplemented Step';
});