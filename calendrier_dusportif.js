var config = require("./config");
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var jsonframe = require('jsonframe-cheerio');
var mongoose = require('mongoose');
var winston = require('winston');
var epreuveModel = require('./api/models/epreuveModel');
var villeModel = require('./api/models/villeModel');
var Ville = mongoose.model('ville');
var Epreuve = mongoose.model('epreuve');

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
$navInfo['page']['rootPage'] = 'http://www.calendrier.dusportif.fr';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'http://www.calendrier.dusportif.fr/agenda-course-routes';
$navInfo['page']['degraded'] = 0;
$navInfo['proxies'] = config.proxies;

// Recupere les infos sur la page qui liste les liens vers les détails (notamment l'url des détails)
let frameCourses = {
	"root": {
		"_s": ".vevent",
		"_d": [{
			"name": ".summary",
			"date": ".dtstart span @ title",
			"course": ".summary a @ href",
			"type": "td + td + td",
			"url": " a @ href"
		}]
	}
};

// Recupere les info sur la page de détail
let frameCourse = {
	"root": {
		"_s": "#conteneur",
		"_d": [{
			"title": "h1 || (.*) //",
			"type": "td[class='category breadcrumb'] a",
			"description": "#content_informations",
			"date": ".dtstart @ title",
			"depart": "td[id=depart] + td",
			"distance": "td[id=distance] + td | number",
			"denivele": "td[id=denivele] + td | number",
			"contact": "td[id=contact] + td span",
			"phone": "td[id=contact] + td | number",
			"mail_img": "td[id=contact] + td img[width=500] @ src",
			"tarifs": "td[id=tarifs] + td",
			"start_inscritption" : "td:contains('Début dеѕ іnѕcrіptіоnѕ') + td",
			"end_inscritption" : "td:contains('Fіn dеѕ іnѕcrіptіоnѕ') + td",
			"formulaire": "td:contains('Fоrmulаіrе') + td a @ href",
			"url_club": "td:contains('Pluѕ ') + td a @ href",
			"commune": "[class='locality target']",
			"commune_req": "[class='locality target'] | words_no_space no_accent uppercase",
			"code_postal": ".postal-code",
			"adresse": ".street-address"
		}]
	}
};

// Recupere l'url vers la page suivante
let frameNextPageUrl = {
	"next": "a[class='prevnext next'] @ href"
};

// inteval avant dappeler une page suivante
var $timeinterval = 2000; // 5s

// start with openning the start page
//parser_page($navInfo, $timeinterval);
$navInfo['page']['currentPage'] = 'https://www.calendrier.dusportif.fr/10km-cannes-07280';
parser_article($navInfo, function(){ logger.debug('Callback'); });

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
		//'http://www.jogging-international.net/courses/calendrier/page-12?country_code=FR&date_begin=&date_end=&fs=1&q=';
		logger.error("Failed to load page URL %s on proxy %s. Error: " + error + ", Statut Code: " + response.statusCode, options.url, options.proxy);
		if(navInfo['page']['degraded'] < 10 ) {
			// skip the failed page and go to the next
			function goNextPage(str, p1, offset, s) {
				return '-p' + (parseInt(p1, 10)+1);
			}
						
			let test = /-p(\d+)$/;
			
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
	  //proxy: navInfo['proxies'][x],
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
			course.root[0].random = Math.floor((Math.random() * 9) + 1);
		
			// management des dates
			let tmpDate = course.root[0].date;
			course.root[0].start_date = tmpDate.substring(0, 4) + '-' + tmpDate.substring(4, 6) + '-' + tmpDate.substring(6, 8);
			
			// management de la zone divers
			if(course.root[0].description.indexOf('--') != -1){
				course.root[0].description = null;
			}

			if(course.root[0].denivele.indexOf('--') != -1){
				course.root[0].denivele = null;
			}

			if(course.root[0].tarifs.indexOf('--') != -1){
				course.root[0].tarifs = null;
			}
			/*
			tmpEpreuve['prices'] = [];

			if(indexPrixSurPlace != -1){
				tmpEpreuve.prixplace = dataDivers.substring(indexPrixSurPlace+29, dataDivers.length);
				let parserString = parsePrixString(tmpEpreuve.prixplace, true);
				for(let tmpPrice of parserString['prices']){
					tmpEpreuve['prices'].push(tmpPrice);
				}
				dataDivers = dataDivers.substring(0, indexPrixSurPlace-1);
			}
			*/

			// distance: replace , point . to avoid cast exception
			if(course.root[0].distance.indexOf('--') != -1){
				course.root[0].distance = null;
			}

			let regexSlachNamePhoto = /\//g;
			let regexDoublePointNamePhoto = /:/g;
			download(navInfo['page']['rootPage'] + course.root[0].mail_img , 'post/mails/'+course.root[0].urlid.replace(regexSlachNamePhoto, '_').replace(regexDoublePointNamePhoto, '_') + '_mail.jpg', function(){
				console.log('done');
			});

			let regex = /(\d{2})/g;
			let phonesNumber = course.root[0].phone.match(regex);
			if(phonesNumber != null && phonesNumber.length > 4){
				course.root[0].phone = phonesNumber[0] + ' ' + phonesNumber[1] + ' ' + phonesNumber[2]+ ' ' + phonesNumber[3]+ ' ' + phonesNumber[4];
			}

			if(phonesNumber != null && phonesNumber.length > 9){
				course.root[0].phone2 = phonesNumber[5] + ' ' + phonesNumber[6] + ' ' + phonesNumber[7]+ ' ' + phonesNumber[8]+ ' ' + phonesNumber[9];
			}
			
			Epreuve.find({ urlid: options.url }, function(err, findResult) {
				if (err){
					logger.error('Unable to find the race. URL %s', options.url, err);
					callback();
				}else{
					if(findResult.length == 0){
						/// try to find the town
						Ville.find({ SORT_NAME_RO: course.root[0].commune_req, NAME_RANK: '1' }, function(err, findVilleResult) {
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
									/*
									for(let tmpEpreuve of course.root[0]._epreuves_){
										tmpEpreuve._id = new mongoose.Types.ObjectId();
										tmpEpreuve.epreuves = [];
									}

									for(let tmpEpreuve of course.root[0]._epreuves_){
										for(let tmp of course.root[0]._epreuves_){
											if(!tmp._id.equals(tmpEpreuve._id)){
												tmpEpreuve.push(tmp);
											}
										}
									
										var mEp = new epreuveModel(Object.assign(tmpEpreuve, course.root[0]));
										mEp.save(function(err){
											if (err){
												logger.error('Unable to save the epreuve.', err);
												callback();
											}
										});
										*/
										console.log(course.root[0]);
										callback(); //virer 
									//}	
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
			logger.error("Failed to load race URL %s on proxy %s. Statut Code: " + response.statusCode, options.url, options.proxy, error);
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

    let result = {};
    result['prices'] = [];

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
        tmpResult['prix'] = Number(mPrices[0].replace(rePrice, '$1'));
        tmpResult['date'] = date_string.match(reDate)[0];
        tmpResult['date'] =  '20' + tmpResult.date.substring(6,8) + '-' + tmpResult.date.substring(3,5) + '-' + tmpResult.date.substring(0,2);
        tmpResult['type'] = 'all';

        if(dday){
            tmpResult['type'] += '_day';
        }

        result['prices'].push(tmpResult);

    }  else if(mPrices != null && mPrices.length > 1){

        let tmpResultAll = {};
        let tmpResultLic = {};

        let prix1 = Number(mPrices[0].replace(rePrice, '$1'));
        let prix2 = Number(mPrices[1].replace(rePrice, '$1'));

        if(prix1 > prix2){
            tmpResultAll['prix'] = prix1; 
            tmpResultLic['prix'] = prix2;
        }else{
            tmpResultAll['prix'] = prix2;
            tmpResultLic['prix'] = prix1
        }

        tmpResultAll['type'] = 'all';
        tmpResultLic['type'] = 'licence';

        if(dday){
            tmpResultAll['type'] += '_day';
            tmpResultLic['type'] += '_day';
        }

        result['prices'].push(tmpResultAll);
        result['prices'].push(tmpResultLic);
    }else{

        let tmpResult = {};
        tmpResult.prix = Number(mPrices[0].replace(rePrice, '$1'));
        tmpResult.type = 'all';
        if(dday){
            tmpResult.type += '_day';
        }

        result['prices'].push(tmpResult);

    }
    return result;
}

function download($url, filename, callback){

	let options = {
		url: 'https://www.calendrier.dusportif.fr/mel/MjAxODAyMjMwMDcxMXw3MjgwfDc3LjE0MS4yOC4xNDk=.jpg',
		//proxy: navInfo['proxies'][x],
		headers: {
		  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
		}
	  };

	request(options).pipe(fs.createWriteStream(filename)).on('close', callback);

};
  
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