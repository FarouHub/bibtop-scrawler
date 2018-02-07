var cheerio = require('cheerio');
var request = require('request');
var jsonframe = require('jsonframe-cheerio');

var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'http://www.calendrier.dusportif.fr';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'http://www.calendrier.dusportif.fr/agenda-course-routes';


let frameCourses = {
	"root": {
		_s: ".vevent",
		_d: [{
			"name": ".summary",
			"date": ".dtstart span @ title",
			"course": ".summary a @ href",
			"type": "td + td + td"
		}]
	}
};

let frameCourse = {
	"root": {
		_s: "article",
		_d: [{
			"title": "h1 || (.*) //",
			"description": ".tm-article-date div"
		}]
	}
};

let frameNextPageUrl = {
	"next": ".pages_number a @ href"
};

// inteval avant dappeler une page suivante
var $timeinterval = 1000; // 5s

// start with openning the start page
parser_page($navInfo, $timeinterval);
//$navInfo['page']['currentPage'] = 'https://www.sporkrono.fr/index.php/article-trail-blanc-gaschney';
//parser_article($navInfo);
/*
- Get liste articles de l'URL $current_url using $path_liste_articles
	-- for each PARSE_DETAIL()
- Recherche URL using $path_URL_next_page --> $next_page
	-- appel fonction PARSER_PAGE ($next_page, $path_URL_next_page)
*/
function parser_page(navInfo, $timeinterval){
	
	let options = {
	  url: navInfo['page']['currentPage'],
	  headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
	  }
	};
	
	request(options, function (error, response, html) {
	  if (!error && response.statusCode == 200) {
		// parsing the html page with cheerio
		let $ = cheerio.load(html);
		jsonframe($);
		
		let articles = $('body').scrape(frameCourses);
		let nextPage = $('body').scrape(frameNextPageUrl);
		console.log(articles);
		console.log(nextPage.next);
		
		let index = 0;
		articles['root'].forEach(function(course) {
			if(typeof course.course != 'undefined'){
				let navInfoArticle = copyArray(navInfo);
				
				if($navInfo['page']['addRoot']){
					course.course = $navInfo['page']['rootPage'] + course.course;
				}
				
				navInfoArticle['page']['currentPage'] = course.course;
				//setTimeout(function(){parser_article(navInfoArticle)}, $timeinterval*index);
			}
			index++;
		});

		if(typeof nextPage.next != 'undefined'){
			
			if($navInfo['page']['addRoot']){
					nextPage.next = $navInfo['page']['rootPage'] + nextPage.next;
				}
			
			console.log('[DEBUG] Next page find: ' + nextPage.next);
			let navInfoNextPage = copyArray(navInfo);
			navInfoNextPage['page']['currentPage'] = nextPage.next;
			parser_page(navInfoNextPage, $timeinterval);
		}

	  }else{
		  console.log("[EROOR]: Failed to load page " + error + " Statut Code:" + response.statusCode);
	  }
	});
}

function parser_article(navInfo){
	
	let options = {
	  url: navInfo['page']['currentPage'],
	  headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
	  }
	};
	
	request(options, function (error, response, html) {
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