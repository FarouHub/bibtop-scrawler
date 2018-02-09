var cheerio = require('cheerio');
var request = require('request');
var jsonframe = require('jsonframe-cheerio');

var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'https://www.sporkrono.fr';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'https://www.sporkrono.fr/index.php/inscriptions';
$navInfo['page']['path_url_next_page'] = null;

let frameCourses = {
	"root": {
		_s: ".uk-table tr",
		_d: [{
			"name": "td",
			"date": "td + td",
			"course": "td a @ href",
			"type": "td + td + td"
		}]
	}
}

let frameCourse = {
	"root": {
		_s: "article",
		_d: [{
			"title": "h1 || (.*) //",
			"description": ".tm-article-date div"
		}]
	}
}

// inteval avant dappeler une page suivante
var $timeinterval = 1000; // 5s

// start with openning the start page
//parser_page($navInfo, $timeinterval);
$navInfo['page']['currentPage'] = 'https://www.sporkrono.fr/index.php/article-trail-blanc-gaschney';
parser_article($navInfo);
/*
- Get liste articles de l'URL $current_url using $path_liste_articles
	-- for each PARSE_DETAIL()
- Recherche URL using $path_URL_next_page --> $next_page
	-- appel fonction PARSER_PAGE ($next_page, $path_URL_next_page)
*/
function parser_page(navInfo, $timeinterval){

	request(navInfo['page']['currentPage'], function (error, response, html) {
	  if (!error && response.statusCode == 200) {
		// parsing the html page with cheerio
		let $ = cheerio.load(html);
		jsonframe($);
		
		let articles = $('body').scrape(frameCourses);
		//let nextPage = $(navInfo['page']['path_url_next_page']);
		console.log(articles);
		
		let index = 0;
		articles['root'].forEach(function(course) {
			if(typeof course.course != 'undefined'){
				let navInfoArticle = copyArray(navInfo);
				
				if($navInfo['page']['addRoot']){
					course.course = $navInfo['page']['rootPage'] + course.course;
				}
				
				navInfoArticle['page']['currentPage'] = course.course;
				setTimeout(function(){parser_article(navInfoArticle)}, $timeinterval*index);
			}
			index++;
		});
/*
		if(typeof nextPage != 'undefined' && nextPage.attr('href') != 'undefined'){
			console.log('[DEBUG] Next page find: ' + 'https:' + nextPage.attr('href'));
			let navInfoNextPage = copyArray(navInfo);
			navInfoNextPage['page']['currentPage'] = 'https:' + nextPage.attr('href');
			parser_page(navInfoNextPage, $timeinterval);
		}
*/
	  }
	});
}

function parser_article(navInfo){
	
	request(navInfo['page']['currentPage'], function (error, response, html) {
		if (!error && response.statusCode == 200) {
			console.log('[DEBUG] Open article URL: ' + navInfo['page']['currentPage']);
			let $ = cheerio.load(html);
			// initializes the jsonframe-cheerio plugin
			jsonframe($);
			
			let course =  $('body').scrape(frameCourse);
			console.log(course);
		}
	});
}

function copyArray(mArr){
	var $newArr = [];
	Object.keys(mArr).forEach(function(key,index) {
		$newArr[key] = {};
		Object.keys(mArr[key]).forEach(function(key2d,index2d) {
			$newArr[key][key2d] = mArr[key][key2d];
		});
	});
	
	return $newArr;
}