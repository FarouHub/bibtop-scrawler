var config = require("./config");
var cheerio = require('cheerio');
var request = require('request');
var jsonframe = require('jsonframe-cheerio');
var mongoose = require('mongoose');
var winston = require('winston');
var courseModel = require('./api/models/courseModel');
var villeModel = require('./api/models/villeModel');
var villeApi = mongoose.model('ville');
var courseApi = mongoose.model('course');

// init the logger
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ name: 'bibtop_console', colorize: true, level: 'debug' }),
        new (winston.transports.File)({ name: 'bibtop_log', filename: 'bibtop.log', level: 'info' }),
        new (winston.transports.File)({ name: 'bibtop_log_error', filename: 'bibtop_error.log', level: 'error' }),
    ]
});

// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect(config.mongodb);
logger.debug('Connect to mongodb: ' + config.mongodb);

// Info de navigation
var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'http://www.jogging-international.net';
$navInfo['page']['addRoot'] = true;
//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/calendrier?fs=1&q=&date_begin=&date_end=&country_code=FR';
$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/calendrier/page-12?country_code=FR&date_begin=&date_end=&fs=1&q=';
$navInfo['page']['degraded'] = 0;
$navInfo['proxies'] = config.proxies;

// Recupere les infos sur la page qui liste les liens vers les détails (notamment l'url des détails)
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

// Recupere les info sur la page de détail
let frameCourse = {
	"root": {
		"_s": "section article",
		"_d": [{
			"title": "h1",
			"date": "[itemprop=articleBody] ul li || : (.*)",
			"region": "[itemprop=articleBody] ul + ul li || : (.*)",
			"commune": "[itemprop=articleBody] ul + ul li + li || : (.*) | before(()",
			"commune_req": "[itemprop=articleBody] ul + ul li + li || : (.*) | before(() | no_accent words_no_space uppercase",
			"codepostal": "[itemprop=articleBody] ul + ul li + li || : (.*) ",
			"depart": "[itemprop=articleBody] ul + ul li + li + li || : (.*)",
			"service" : "h2:contains('Services') + ul li:contains('Service') || : (.*)",
			"recompences" : "h2:contains('Services') + ul li:contains('Récompenses') || : (.*)",
			"animation" : "h2:contains('Services') + ul li:contains('Animation') || : (.*)",
			"contact": "h2:contains('Contact') + div li:contains('Contact') || : (.*)",
			"phone": "h2:contains('Contact') + div li:contains('Tél') || : (.*)",
			"mail": "h2:contains('Contact') + div li:contains('Email') || : (.*)",
			"url_club": ".bt-jog @ href",
			"epreuves": {
			"_s": ".jog-data-tab tr",
			"_d": [{"name": "span || - (.*)",
					"distance": "span || ([\\d,\\.]+)",
					"type": "th < html | after(span>)",
					"divers": "ul"
					}]
			}
		}]
	}
};

// Recupere l'url vers la page suivante
let frameNextPageUrl = {
	"next": ".prev-next a[rel=next] @ href"
};

// inteval avant dappeler une page suivante
var $timeinterval = 2000; // 5s

// start with openning the start page
parser_page($navInfo, $timeinterval);
//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/2248-le-maxi-cross-de-la-foret';
//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/2737-gruissan-phoebus-trail';
//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/7521-trail-des-loups';
//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/7944-pyjama-trail-party';
//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/7859-trail-du-chemin-des-moines-nocturne';

//$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/5383-foulees-de-saint-armel';
//parser_article($navInfo, function(){ logger.debug('Callback'); });

/**
 * 
 * @param {*} navInfo 
 * @param {*} timeinterval
 */
function parser_page(navInfo, timeinterval) {
	// x = choice between my 10 proxies
	var x = Math.floor((Math.random() * 9) + 1);
	let options = {
	  url: navInfo['page']['currentPage'],
	  proxy: navInfo['proxies'][x],
	  headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
	  }
	};
	
	logger.info('Open page URL: %s on proxy %s', options.url, options.proxy);
	request(options, function (error, response, html) {
	  if (!error && response.statusCode == 200) {
		// parsing the html page with cheerio
		let $ = cheerio.load(html);
		jsonframe($);
		
		let articles = $('body').scrape(frameCourses);
		let nextPage = $('body').scrape(frameNextPageUrl);
		
		let index = 0;
		let timeToFinish = 0 ;

		// parsing eatch article one by one
		articles['root'].forEach(function(detail) {
			if(typeof detail.url != 'undefined') {
				timeToFinish++;

				let navInfoArticle = copyArray(navInfo);
				
				if($navInfo['page']['addRoot']){
					detail.url = $navInfo['page']['rootPage'] + detail.url;
				}
				
				navInfoArticle['page']['currentPage'] = detail.url;
				setTimeout(function(){parser_article(navInfoArticle, function(){timeToFinish--;})}, timeinterval*index);
			}
			index++;
		});

		logger.debug('Try to get the next page');
		// try to go to the next page
		if(typeof nextPage.next != 'undefined'){
			
			if($navInfo['page']['addRoot']){
				nextPage.next = $navInfo['page']['rootPage'] + nextPage.next;
			}
			
			let navInfoNextPage = copyArray(navInfo);
			navInfoNextPage['page']['currentPage'] = nextPage.next;
			
			waitFor(function() {
				// Check in the page if a specific element is now visible
				return timeToFinish == 0;
			}, function() {
			   logger.debug('Go to the next page: %s', nextPage.next);
			   parser_page(navInfoNextPage, timeinterval);
			});
		}

	  } else {
		logger.error("Failed to load page URL %s on proxy %s. Error: " + error + ", Statut Code: " + response.statusCode, options.url, options.proxy);
		if(navInfo['page']['degraded'] < 10 ) {
			// skip the failed page and go to the next
			function goNextPage(str, p1, offset, s) {
				return 'page-' + (parseInt(p1, 10)+1) + '?';
			}
						
			let test = /page-(\d+)\?/;
			
			navInfo['page']['currentPage'] = navInfo['page']['currentPage'].replace(test, goNextPage);
			navInfo['page']['degraded']++,
			logger.warn("Go to the next page in degraded mode. URL %s on proxy %s", navInfo['page']['currentPage'], options.proxy);
			parser_page(navInfo, timeinterval);
		} else {
			logger.error("Degraded ("+ navInfo['page']['degraded'] +") Statut Code:" + response.statusCode);
		}
	  }
	});
}

/**
 * 
 * @param {*} navInfo 
 * @param {*} callback 
 */
function parser_article(navInfo, callback) {
	var x = Math.floor((Math.random() * 9) + 1);
	let options = {
	  url: navInfo['page']['currentPage'],
	  proxy: navInfo['proxies'][x],
	  headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
	  }
	};
	
	logger.info('Open race URL: %s on proxy %s', options.url, options.proxy);
	request(options, function (error, response, html) {
		if (!error && response.statusCode == 200) {
			let $ = cheerio.load(html);
			// initializes the jsonframe-cheerio plugin
			jsonframe($);
			
			let course =  $('body').scrape(frameCourse);
			course.root[0].urlid = options.url;
			course.root[0].random = Math.floor((Math.random() * 7) + 1);
		
			// management des dates
			let tmpDate = course.root[0].date;
			if(tmpDate.length > 10){
				course.root[0].end_date = tmpDate.substring(19, 23) + '-' + tmpDate.substring(16, 18) + '-' + tmpDate.substring(13, 15);
			}

			course.root[0].start_date = tmpDate.substring(6, 10) + '-' + tmpDate.substring(3, 5) + '-' + tmpDate.substring(0, 2);

			// management de la zone divers
			let cacheType = 'Standard';

			for(let tmpEpreuve of course.root[0].epreuves){
				let dataDivers = tmpEpreuve.divers;
				let indexDepart = dataDivers.indexOf('Départ :');
				let indexDescription = dataDivers.indexOf('Description :');
				let indexPrix = dataDivers.indexOf('Prix inscription :');
				let indexPrixSurPlace = dataDivers.indexOf('Prix inscription sur place :');
				let indexInscription = dataDivers.indexOf('Nombre arrivants :');

				if(indexDescription != -1){
					tmpEpreuve.description = dataDivers.substring(indexDescription+14, dataDivers.length);
					dataDivers = dataDivers.substring(0, indexDescription-1);
				}

				if(indexInscription != -1){
					tmpEpreuve.maxinscription = dataDivers.substring(indexInscription+19, dataDivers.length);
					dataDivers = dataDivers.substring(0, indexInscription-1);
				}

				tmpEpreuve.prices = [];

				if(indexPrixSurPlace != -1){
					tmpEpreuve.prixplace = dataDivers.substring(indexPrixSurPlace+29, dataDivers.length);
					let parserString = parsePrixString(tmpEpreuve.prixplace, true);
					for(let tmpPrice of parserString){
						tmpEpreuve.prices.push(tmpPrice);
					}
					dataDivers = dataDivers.substring(0, indexPrixSurPlace-1);
				}

				if(indexPrix != -1){
					tmpEpreuve.prix = dataDivers.substring(indexPrix+19, dataDivers.length);
					let parserString = parsePrixString(tmpEpreuve.prix, false);
					for(let tmpPrice of parserString){
						tmpEpreuve.prices.push(tmpPrice);
					}
					dataDivers = dataDivers.substring(0, indexPrix-1);
				}
				tmpEpreuve.prices = JSON.stringify(tmpEpreuve.prices);

				//console.log(tmpEpreuve.prices);

				tmpEpreuve.depart = dataDivers.substring(indexDepart+9, dataDivers.length); // +8 ton skip Départ :

				if(typeof tmpEpreuve.type != 'undefined' && tmpEpreuve.type.indexOf('<span>') == -1){
					cacheType = tmpEpreuve.type;
				}else{
					tmpEpreuve.type = cacheType;
				}

				// distance: replace , point . to avoid cast exception
				if(typeof tmpEpreuve.distance != 'undefined' && tmpEpreuve.distance.indexOf(',') != -1){
					tmpEpreuve.distance = tmpEpreuve.distance.replace(',', '.');
				} 

				tmpEpreuve.divers = null;
			}
			
			courseApi.find({ urlid: options.url }, function(err, findResult) {
				if (err){
					logger.error('Unable to find the race. URL %s', options.url, err);
					callback();
				}else{
					if(findResult.length == 0){
						/// try to find the town
						villeApi.find({ SORT_NAME_RO: course.root[0].commune_req, NAME_RANK: '1' }, function(err, findVilleResult) {
							if (err){
								logger.error('Unable to find the city. URL %s', options.url, { SORT_NAME_RO: course.root[0].commune_req }, err);
								callback();
							}else{
								if(findVilleResult.length == 0){
									logger.error("La ville %s n'a pas été trouvée dans la base. URL %s", course.root[0].commune_req, options.url);
									callback();
								}else if(findVilleResult.length > 1){
									logger.error("La ville %s a été trouvée en plusieurs exemplaires dans la base. URL %s", course.root[0].commune_req, options.url);
									callback();
								}else{
									//console.log('lat: ' + findVilleResult[0].LAT + ' long: ' + findVilleResult[0].LONG);
									course.root[0].lat =  findVilleResult[0].LAT;
									course.root[0].long =  findVilleResult[0].LONG;

									var new_course = new courseModel(course.root[0]);
									new_course.save(function(err, saveResult) {
										if (err){
											logger.error('Unable to save the race. URL %s', options.url, err);
											callback();
										}else{
											logger.info("Le document %s a bien été inséré", options.url);
											callback();
										}
									});
								}
							}
						});
					}else{
						logger.info("Le document %s existe deja", options.url);
						callback();
					}
				}
			});
		}else{
			logger.error("Failed to load race URL %s on proxy %s. Error: " + error + ", Statut Code: " + response.statusCode, options.url, options.proxy);
			callback();
		}
	});
}

/**
 * 
 * @param {*} date_string 
 * @param {*} dday 
 */
function parsePrixString(date_string, dday){

    // licence, licence_day, all, all_day

    let result = [];

    let reDate = /(\d+\/\d+\/\d+)/g;
	let rePrice = null;
	
	if(date_string.indexOf('€') != -1){
		rePrice = /(\d+)\s*€/g;
	}else if(date_string.indexOf('¤') != -1){
		rePrice = /(\d+)\s*¤/g;
	}else{
		rePrice = /(\d+)\s*/g;
    }
    
    let mPrices = date_string.match(rePrice);

    if(date_string.indexOf('tarif') != -1){
        let tmpResult = {};
        tmpResult.prix = mPrices[0].replace(rePrice, '$1');
        tmpResult.date = date_string.match(reDate)[0];
        tmpResult.date =  '20' + tmpResult.date.substring(6,8) + '-' + tmpResult.date.substring(3,5) + '-' + tmpResult.date.substring(0,2);
        tmpResult.type = 'all';

        if(dday){
            tmpResult.type += '_day';
        }

        result.push(tmpResult);
    }  else if(mPrices != null && mPrices.length > 1){

        let tmpResultAll = {};
        let tmpResultLic = {};

        let prix1 = Number(mPrices[0].replace(rePrice, '$1'));
        let prix2 = Number(mPrices[1].replace(rePrice, '$1'));

        if(prix1 > prix2){
            tmpResultAll.prix = prix1; 
            tmpResultLic.prix = prix2;
        }else{
            tmpResultAll.prix = prix2;
            tmpResultLic.prix = prix1
        }

        tmpResultAll.type = 'all';
        tmpResultLic.type = 'licence';

        if(dday){
            tmpResultAll.type += '_day';
            tmpResultLic.type += '_day';
        }

        result.push(tmpResultAll);
        result.push(tmpResultLic);
    }else{

        let tmpResult = {};
        tmpResult.prix = mPrices[0].replace(rePrice, '$1');
        tmpResult.type = 'all';
        if(dday){
            tmpResult.type += '_day';
        }

        result.push(tmpResult);

    }
    return result;
}

/**
 * The method wait on conditions to do something
 * @param {*} testFx String condition or function (need return true or false) you need to test
 * @param {*} onReady String or function you need to execute when testFx is true
 * @param {*} timeOutMillis Time is ms between eatch check of the conditions 
 */
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

/**
 * The method copy an array in 2d
 * @param {*} mArr Here the array you need to copy
 */
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