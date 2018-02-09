var cheerio = require('cheerio');
var request = require('request');
var jsonframe = require('jsonframe-cheerio');
var mongoose = require('mongoose');
var courseModel = require('./api/models/courseModel');
var villeModel = require('./api/models/villeModel');
var villeApi = mongoose.model('ville');
var courseApi = mongoose.model('course');

// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect("mongodb://localhost/todorace");


/* Info de navigation */
var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'http://www.jogging-international.net';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/calendrier?fs=1&q=&date_begin=&date_end=&country_code=FR';
//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/calendrier/page-3?fs=1&q=&date_begin=&date_end=&country_code=FR';
$navInfo['page']['degraded'] = 0;
$navInfo['proxies'] = [];
$navInfo['proxies'][0] = 'http://173.234.249.27:3128';
$navInfo['proxies'][1] = 'http://23.19.32.47:3128';
$navInfo['proxies'][2] = 'http://23.19.32.150:3128';
$navInfo['proxies'][3] = 'http://173.234.249.204:3128';
$navInfo['proxies'][4] = 'http://173.234.232.93:3128'
$navInfo['proxies'][5] = 'http://173.208.39.197:3128';
$navInfo['proxies'][6] = 'http://23.19.32.170:3128';
$navInfo['proxies'][7] = 'http://23.19.32.163:3128';
$navInfo['proxies'][8] = 'http://173.208.39.172:3128';
$navInfo['proxies'][9] = 'http://173.234.232.204:3128';

/* Recupere les infos sur la page qui liste les liens vers les détails (notamment l'url) */
let frameCourses = {
	"root": {
		"_s": "article",
		"_d": [{
			"name": ".date-result + a @ title",
			"date": ".date-result",
			"url": ".date-result + a @ href"
		}]
	}
};
// [".jog-data-tab tr "]
/* Recupere les info sur la page de détail */
let frameCourse = {
	"root": {
		"_s": "section article",
		"_d": [{
			"title": "h1",
			"date": "[itemprop=articleBody] ul li || : (.*)",
			"region": "[itemprop=articleBody] ul + ul li || : (.*)",
			"commune": "[itemprop=articleBody] ul + ul li + li || : (.*) | before(()",
			"codepostal": "[itemprop=articleBody] ul + ul li + li || : (.*) ", // | nb
			"depart": "[itemprop=articleBody] ul + ul li + li + li || : (.*)",
			"contact": "h2:contains('Contact') + div li || : (.*)",
			"phone": "h2:contains('Contact') + div li + li || : (.*)",
			"mail": "h2:contains('Contact') + div li + li + li || : (.*)",
			"url_club": ".bt-jog @ href",
			"epreuves": {
			"_s": ".jog-data-tab tr",
			"_d": [{"name": "span || - (.*)",
					"distance": "span || ([\\d,\\.]+)",
					"type": "th < html | after(span>)",
					"heuredepart": "li || : (.*)",
					"prix": "li + li || : (.*)",
					"prixsurplace": "li + li + li || : (.*)",
					"description" : "li + li + li + li || : (.*)"
					}]
			}
		}]
	}
};

/* Recupere l'url vers la page suivante */
let frameNextPageUrl = {
	"next": ".prev-next a[rel=next] @ href"
};

// inteval avant dappeler une page suivante
var $timeinterval = 2000; // 5s

// start with openning the start page
parser_page($navInfo, $timeinterval);
//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/7223-teteghem-cross';
//parser_article($navInfo, function(){});

/*
- Get liste articles de l'URL $current_url using $path_liste_articles
	-- for each PARSE_DETAIL()
- Recherche URL using $path_URL_next_page --> $next_page
	-- appel fonction PARSER_PAGE ($next_page, $path_URL_next_page)
*/
function parser_page(navInfo, $timeinterval){
	var x = Math.floor((Math.random() * 9) + 1);
	let options = {
	  url: navInfo['page']['currentPage'],
	  proxy: navInfo['proxies'][x],
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
		//console.log(articles);
		//console.log(nextPage.next);
		
		let index = 0;
		let timeToFinish = 0 ;
		console.log('length: ' + timeToFinish);
		articles['root'].forEach(function(detail) {
			if(typeof detail.url != 'undefined'){
				timeToFinish++;
			
				let navInfoArticle = copyArray(navInfo);
				
				if($navInfo['page']['addRoot']){
					detail.url = $navInfo['page']['rootPage'] + detail.url;
				}
				
				navInfoArticle['page']['currentPage'] = detail.url;
				setTimeout(function(){parser_article(navInfoArticle, function(){timeToFinish--;})}, $timeinterval*index);
			}
			index++;
		});

		if(typeof nextPage.next != 'undefined'){
			
			if($navInfo['page']['addRoot']){
				nextPage.next = $navInfo['page']['rootPage'] + nextPage.next;
			}
			
			let navInfoNextPage = copyArray(navInfo);
			navInfoNextPage['page']['currentPage'] = nextPage.next;
			
			waitFor(function() {
				// Check in the page if a specific element is now visible
				console.log('timeToFinish: ' + timeToFinish);
				return timeToFinish == 0;
			}, function() {
			   console.log('[DEBUG] Go to the next page: ' + nextPage.next);
			   parser_page(navInfoNextPage, $timeinterval);
			});
		}

	  }else{
		console.log("[ERROR]: Failed to load page " + error + " Statut Code:" + response.statusCode);
		if(navInfo['page']['degraded'] < 10 ){
			// skip the failed page and go to the next
			function goNextPage(str, p1, offset, s) {
				return 'page-' + (parseInt(p1, 10)+1) + '?';
			}
						
			let test = /page-(\d+)\?/;
			
			navInfo['page']['currentPage'] = navInfo['page']['currentPage'].replace(test, goNextPage);
			navInfo['page']['degraded']++,
			console.log("[DEBUG]: Go to the next page in degraded mode " + navInfo['page']['currentPage']);
			parser_page(navInfo, $timeinterval);
		} else {
			console.log("[ERROR]: Degraded ("+ navInfo['page']['degraded'] +") Statut Code:" + response.statusCode);
		}
	  }
	});
}

function parser_article(navInfo, callback){
	var x = Math.floor((Math.random() * 9) + 1);
	let options = {
	  url: navInfo['page']['currentPage'],
	  proxy: navInfo['proxies'][x],
	  headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
	  }
	};
	
	request(options, function (error, response, html) {
		if (!error && response.statusCode == 200) {
			console.log('[DEBUG] Open article URL: ' + options.url + ' avec le proxy ' + options.proxy);
			let $ = cheerio.load(html);
			// initializes the jsonframe-cheerio plugin
			jsonframe($);
			
			let course =  $('body').scrape(frameCourse);
			course.root[0].urlid = options.url;
			course.root[0].random = Math.floor((Math.random() * 5) + 1);
			//console.log(course.root);
			
			
			//mongodb://spartan:pioupiou123@cluster0-shard-00-00-hfhr2.mongodb.net:27017,cluster0-shard-00-01-hfhr2.mongodb.net:27017,cluster0-shard-00-02-hfhr2.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin
			// BEGIN DB stuff

			courseApi.find({ urlid: options.url }, function(err, findResult) {
				console.log('err: ' + err);
				console.log('findResult: ' + findResult);
				if (err)
					console.log("ERR #1");
				if(findResult.length == 0){
					
					/// try to find the town
					villeApi.find({ FULL_NAME_RO: course.root[0].commune }, function(err, findVilleResult) {
						if (err)
								console.log("ERR #1");
							
						if(findVilleResult.length == 0){
							console.log("## Ville non trouvee");
						}else{
							console.log('lat: ' + findVilleResult[0].LAT + ' long: ' + findVilleResult[0].LONG);
							course.root[0].lat =  findVilleResult[0].LAT;
							course.root[0].long =  findVilleResult[0].LONG;
							var new_course = new courseModel(course.root[0]);
							new_course.save(function(err, saveResult) {
								if (err)
									console.log("ERR #2");
					
								console.log("Le document a bien été inséré");
							});
						}
					});
					////

				}else{
					console.log("Le document existe deja");
				}
			});
			
		
			// END DB stuff
			
			callback();
		}
	});
}

function waitFor(testFx, onReady, timeOutMillis) {
	var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 300000, //< Default Max Timout is 5 min
		start = new Date().getTime(),
		condition = false,
		interval = setInterval(function() {
			if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
				// If not time-out yet and condition not yet fulfilled
				condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
			} else {
				if(!condition) {
					// If condition still not fulfilled (timeout but condition is 'false')
					console.log("'waitFor()' timeout");
					exit(1);
				} else {
					// Condition fulfilled (timeout and/or condition is 'true')
					console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
					typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
					clearInterval(interval); //< Stop this interval
				}
			}
		}, 500); //< repeat check every 250ms
};

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