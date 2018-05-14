var config = require("./config");
let BibScrawler = require('./scrawler');
var mongoose = require('mongoose');
var epreuveModel = require('./api/models/epreuveModel');
var villeModel = require('./api/models/villeModel');

var Ville = mongoose.model('ville');
var Epreuve = mongoose.model('epreuve');

// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect(config.mongodb);

// Info de navigation
var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'http://www.jogging-international.net';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/calendrier?fs=1&q=&date_begin=&date_end=&country_code=FR';
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
			"place_depart": "[itemprop=articleBody] ul + ul li + li + li || : (.*)",
			"service" : "h2:contains('Services') + ul li:contains('Service') || : (.*)",
			"recompences" : "h2:contains('Services') + ul li:contains('Récompenses') || : (.*)",
			"animation" : "h2:contains('Services') + ul li:contains('Animation') || : (.*)",
			"contact": "h2:contains('Contact') + div li:contains('Contact') || : (.*)",
			"phone": "h2:contains('Contact') + div li:contains('Tél') || : (.*)",
			"mail": "h2:contains('Contact') + div li:contains('Email') || : (.*)",
			"url_club": ".bt-jog @ href",
			"_epreuves_": {
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


let scrawler = new BibScrawler();

scrawler.load('jogging_international', frameCourses, frameCourse, frameNextPageUrl);

scrawler.parser_site($navInfo, function(item, next){
			item.random = Math.floor((Math.random() * 9) + 1);
		
			// management des dates
			let tmpDate = item.date;
			if(tmpDate.length > 10){
				item.end_date = tmpDate.substring(19, 23) + '-' + tmpDate.substring(16, 18) + '-' + tmpDate.substring(13, 15);
			}

			item.start_date = tmpDate.substring(6, 10) + '-' + tmpDate.substring(3, 5) + '-' + tmpDate.substring(0, 2);

			// management de la zone divers
			let cacheType = 'Standard';

			for(let tmpEpreuve of item._epreuves_){
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

				tmpEpreuve['prices'] = [];

				if(indexPrixSurPlace != -1){
					tmpEpreuve.prixplace = dataDivers.substring(indexPrixSurPlace+29, dataDivers.length);
					let parserString = parsePrixString(tmpEpreuve.prixplace, true);
					for(let tmpPrice of parserString['prices']){
						tmpEpreuve['prices'].push(tmpPrice);
					}
					dataDivers = dataDivers.substring(0, indexPrixSurPlace-1);
				}

				if(indexPrix != -1){
					tmpEpreuve.prix = dataDivers.substring(indexPrix+19, dataDivers.length);
					let parserString = parsePrixString(tmpEpreuve.prix, false);
					for(let tmpPrice of parserString['prices']){
						tmpEpreuve['prices'].push(tmpPrice);
					}
					dataDivers = dataDivers.substring(0, indexPrix-1);
				}

				tmpEpreuve.hour_depart = dataDivers.substring(indexDepart+9, dataDivers.length); // +8 ton skip Départ :

				if(typeof tmpEpreuve.type != 'undefined' && tmpEpreuve.type.indexOf('<span>') == -1){
					cacheType = tmpEpreuve.type;
				}else{
					tmpEpreuve.type = cacheType;
				}

				// distance: replace , point . to avoid cast exception
				if(typeof tmpEpreuve.distance != 'undefined' && tmpEpreuve.distance.indexOf(',') != -1){
					tmpEpreuve.distance = tmpEpreuve.distance.replace(',', '.');
				} 

				let regexName = /(\w+)\s*\(\d+\)/g;
				if(typeof tmpEpreuve.name != 'undefined' && tmpEpreuve.name.match(regexName)){
					tmpEpreuve.name = tmpEpreuve.name.replace(regexName, '$1');
				}

				tmpEpreuve.divers = null;
				//console.log(tmpEpreuve);
			}
			
			Epreuve.find({ urlid: options.url }, function(err, findResult) {
				if (err){
					logger.error('Unable to find the race. URL %s', options.url, err);
					callback();
				}else{
					if(findResult.length == 0){
						/// try to find the town
						Ville.find({ SORT_NAME_RO: item.commune_req, NAME_RANK: '1' }, function(err, findVilleResult) {
							if (err){
								logger.error('Unable to find the city. URL %s', options.url, { SORT_NAME_RO: item.commune_req }, err);
								callback();
							}else{
								if(findVilleResult.length == 0){
									logger.error("La ville %s n'a pas été trouvée dans la base. URL %s", item.commune_req, options.url);
									callback();
								}else if(findVilleResult.length > 1){
									logger.error("La ville %s a été trouvée en plusieurs exemplaires dans la base. URL %s", item.commune_req, options.url);
									callback();
								}else{
									//console.log('lat: ' + findVilleResult[0].LAT + ' long: ' + findVilleResult[0].LONG);
									item.lat =  findVilleResult[0].LAT;
									item.long =  findVilleResult[0].LONG;

									for(let tmpEpreuve of item._epreuves_){
										tmpEpreuve._id = new mongoose.Types.ObjectId();
										tmpEpreuve.epreuves = [];
									}

									for(let tmpEpreuve of item._epreuves_){
										for(let tmp of item._epreuves_){
											if(!tmp._id.equals(tmpEpreuve._id)){
												tmpEpreuve.epreuves.push(tmp);
											}
										}

										var mEp = new epreuveModel(Object.assign(tmpEpreuve, item));
										mEp.save(function(err){
											if (err){
												logger.error('Unable to save the epreuve.', err);
											}
										});
									}
									
									callback();
								}
							}
						});
					}else{
						logger.info("Le document %s existe deja", options.url);
						callback();
					}
				}
			});
	next();
});