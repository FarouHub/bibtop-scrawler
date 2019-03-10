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
console.log('Connect to mongodb: ' + config.mongodb);

// Info de navigation
var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'https://www.le-sportif.com';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'https://www.le-sportif.com/Calendar/CalendarSearch.aspx';
$navInfo['page']['degraded'] = 0;
$navInfo['proxies'] = config.proxies;

// Recupere les infos sur la page qui liste les liens vers les détails (notamment l'url des détails)
let frameCourses = {
	"root": {
		"_s": "article",
		"_d": [{
			"url": ".media-body a @ href"
		}]
	}
};

// Recupere les info sur la page de détail
let frameCourse = {
	"root": {
		"_s": "#ContentPlaceHolder_Content_UpdatePanel_Calendar_4leftcols",
		"_d": [{
			"title": "#ContentPlaceHolder_Content_Label_Event_Name_Title",
			"title_req": "#ContentPlaceHolder_Content_Label_Event_Name_Title | no_accent words_no_space uppercase",
			"date": "#ContentPlaceHolder_Content_Label_HTML_Event_Description .icon-calendar + b",
			"commune": "#ContentPlaceHolder_Content_Label_Event_Place_Title b",
			"commune_req": "#ContentPlaceHolder_Content_Label_Event_Place_Title b | no_accent words_no_space uppercase",
			"description" : "p",
			"type" : "#ContentPlaceHolder_Content_Label_HTML_Event_Description .icon-award + b",
			"_epreuves_": {
			"_s": ".jog-data-tab tr",
			"_d": [{
					"distance": "span || ([\\d,\\.]+)"
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

let logger = scrawler.load('jogging_international', frameCourses, frameCourse, frameNextPageUrl);

scrawler.parser_site($navInfo, function(homeInfo, item, next){
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
			
	Epreuve.find({ urlid: homeInfo.url }, function(err, findResult) {
		if (err){
			logger.error('Unable to find the race. URL %s', homeInfo.url, err);
			next();
		}else{
			if(findResult.length == 0){
				/// try to find the town
				Ville.find({ SORT_NAME_RO: item.commune_req, NAME_RANK: '1' }, function(err, findVilleResult) {
					if (err){
						logger.error('Unable to find the city. URL %s', homeInfo.url, { SORT_NAME_RO: item.commune_req }, err);
						next();
					}else{
						if(findVilleResult.length == 0){
							logger.error("La ville %s n'a pas été trouvée dans la base. URL %s", item.commune_req, homeInfo.url);
							next();
						}else if(findVilleResult.length > 1){
							logger.error("La ville %s a été trouvée en plusieurs exemplaires dans la base. URL %s", item.commune_req, homeInfo.url);
							next();
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
							
							next();
						}
					}
				});
			}else{
				logger.info("Le document %s existe deja", homeInfo.url);
				next();
			}
		}
	});
	next();
});


/**
 * 
 * @param {*} date_string 
 * @param {*} dday 
 */
function parsePrixString(date_string, dday){

    // licence, licence_day, all, all_day
	console.log(date_string);
    let result = {};
    result['prices'] = [];

    let reDate = /(\d+\/\d+\/\d+)/g;
	let rePrice = null;
	
	if(date_string.indexOf('€') != -1){
		rePrice = /(\d+)\s*€/g;
	}else if(date_string.indexOf('¤') != -1){
		rePrice = /(\d+)\s*¤/g;
	}else{
		rePrice = /(\d+)\s*/g;
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

    }else if(date_string.indexOf('gratuit') || date_string.indexOf('Gratuit')){
		let tmpResult = {};
		tmpResult['type'] = 'all';
		tmpResult['prix'] = 0;
		result['prices'].push(tmpResult);
		
	}else if(mPrices != null && mPrices.length > 1){

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